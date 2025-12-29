'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar, Search, Download, Trash2, Edit, X, ChevronDown } from 'lucide-react';

interface TransaksiKas {
  id: number;
  kas_id: number;
  kas_nama?: string;
  tanggal: string;
  waktu: string;
  jenis: 'masuk' | 'keluar';
  kategori: string;
  keterangan: string;
  jumlah: number;
  saldo_setelah: number;
  created_by?: string;
}

interface SaldoInfo {
  saldo_awal: number;
  total_masuk: number;
  total_keluar: number;
  saldo_akhir: number;
}

interface Kas {
  id: number;
  nama_kas: string;
  saldo: number;
}

const KATEGORI_MASUK = [
  'Penjualan Tunai',
  'Pembayaran Piutang',
  'Modal',
  'Pinjaman',
  'Lain-lain'
];

const KATEGORI_KELUAR = [
  'Pembelian',
  'Pembayaran Hutang',
  'Gaji Karyawan',
  'Listrik & Air',
  'Transport',
  'Operasional',
  'Lain-lain'
];

export default function TransaksiKasHarian() {
  const [transaksi, setTransaksi] = useState<TransaksiKas[]>([]);
  const [saldoInfo, setSaldoInfo] = useState<SaldoInfo | null>(null);
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedKas, setSelectedKas] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    kas_id: 1,
    jenis: 'masuk' as 'masuk' | 'keluar',
    kategori: '',
    keterangan: '',
    jumlah: ''
  });

  const [transferData, setTransferData] = useState({
    dari_kas_id: 1,
    ke_kas_id: 1,
    jumlah: '',
    keterangan: ''
  });

  useEffect(() => {
    fetchKasList();
  }, []);

  useEffect(() => {
    if (kasList.length > 0) {
      fetchData();
    }
  }, [selectedDate, selectedKas, kasList]);

  const fetchKasList = async () => {
    try {
      const response = await fetch('/api/keuangan/kas');
      const result = await response.json();
      
      if (result.success && result.data) {
        setKasList(result.data);
        if (result.data.length > 0) {
          setSelectedKas(result.data[0].id);
          setFormData(prev => ({ ...prev, kas_id: result.data[0].id }));
          
          // Set transfer data dengan kas berbeda
          const firstKas = result.data[0].id;
          const secondKas = result.data.length > 1 ? result.data[1].id : firstKas;
          
          setTransferData(prev => ({ 
            ...prev, 
            dari_kas_id: firstKas,
            ke_kas_id: secondKas
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching kas list:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/keuangan/kas-harian?tanggal=${selectedDate}&kas_id=${selectedKas}`);
      const result = await response.json();
      
      if (result.success) {
        setTransaksi(result.data || []);
        setSaldoInfo(result.saldo || null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/keuangan/kas-harian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kas_id: formData.kas_id,
          tanggal: selectedDate,
          jenis: formData.jenis,
          kategori: formData.kategori,
          keterangan: formData.keterangan,
          jumlah: parseFloat(formData.jumlah)
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setShowModal(false);
        setFormData({ 
          kas_id: selectedKas,
          jenis: 'masuk', 
          kategori: '', 
          keterangan: '', 
          jumlah: '' 
        });
        fetchData();
        fetchKasList(); // Refresh saldo kas
      } else {
        alert(result.message || 'Gagal menyimpan transaksi');
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (transferData.dari_kas_id === transferData.ke_kas_id) {
      alert('Tidak bisa transfer ke kas yang sama!');
      return;
    }

    if (parseFloat(transferData.jumlah) <= 0) {
      alert('Jumlah transfer harus lebih dari 0!');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/keuangan/kas-harian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          dari_kas_id: transferData.dari_kas_id,
          ke_kas_id: transferData.ke_kas_id,
          jumlah: parseFloat(transferData.jumlah),
          keterangan: transferData.keterangan,
          tanggal: selectedDate
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowTransferModal(false);
        
        // Reset form dengan kas yang berbeda
        const firstKas = kasList[0]?.id || 1;
        const secondKas = kasList.length > 1 ? kasList[1].id : firstKas;
        
        setTransferData({
          dari_kas_id: firstKas,
          ke_kas_id: secondKas,
          jumlah: '',
          keterangan: ''
        });
        fetchData();
        fetchKasList(); // Refresh saldo kas
        alert('Transfer berhasil!');
      } else {
        alert(result.message || 'Gagal melakukan transfer');
      }
    } catch (error) {
      console.error('Error transfer:', error);
      alert('Terjadi kesalahan saat transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    try {
      setSubmitting(true);
      const response = await fetch(`/api/keuangan/kas-harian?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        fetchData();
        fetchKasList(); // Refresh saldo kas
      } else {
        alert(result.message || 'Gagal menghapus transaksi');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const headers = ['Waktu', 'Jenis', 'Kategori', 'Keterangan', 'Masuk', 'Keluar', 'Saldo'];
    const rows = transaksi.map(t => [
      t.waktu,
      t.jenis,
      t.kategori,
      t.keterangan,
      t.jenis === 'masuk' ? t.jumlah : 0,
      t.jenis === 'keluar' ? t.jumlah : 0,
      t.saldo_setelah
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kas-harian-${selectedDate}.csv`;
    a.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredTransaksi = transaksi.filter(t =>
    t.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.kategori.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        {submitting && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">Memproses...</p>
                <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Transaksi Kas Harian</h1>
          <p className="text-gray-600">Kelola pemasukan dan pengeluaran kas harian</p>
        </div>

        {/* Saldo Cards */}
        {saldoInfo && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-gray-400">
              <div className="text-sm text-gray-600 mb-1">Saldo Awal</div>
              <div className="text-2xl font-bold text-gray-800">{formatCurrency(saldoInfo.saldo_awal)}</div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                Kas Masuk
              </div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(saldoInfo.total_masuk)}</div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                Kas Keluar
              </div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(saldoInfo.total_keluar)}</div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-md p-5 text-white">
              <div className="text-sm mb-1 opacity-90">Saldo Akhir</div>
              <div className="text-2xl font-bold">{formatCurrency(saldoInfo.saldo_akhir)}</div>
            </div>
          </div>
        )}

       {/* Actions Bar */}
<div className="bg-white rounded-xl shadow-md p-3 sm:p-4 mb-6">
  <div className="flex flex-col gap-3 md:flex-row md:gap-4 md:items-center md:justify-between">
    {/* Filters - Stack vertical di mobile */}
    <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row">
      {/* Kas Select */}
      <div className="relative w-full md:max-w-[200px]">
        <select
          value={selectedKas}
          onChange={(e) => setSelectedKas(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
        >
          {kasList.map(kas => (
            <option key={kas.id} value={kas.id}>
              {kas.nama_kas} - {formatCurrency(kas.saldo)}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
      </div>

      {/* Date Input */}
      <div className="relative w-full md:max-w-[180px]">
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Search Input */}
      <div className="relative w-full md:max-w-[250px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari transaksi..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
    </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end sm:justify-start">
  <button
    onClick={exportToExcel}
    className="sm:flex-none px-3 py-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors flex items-center justify-center gap-2"
  >
    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
    <span className="hidden sm:inline">Export</span>
  </button>
  <button
    onClick={() => setShowTransferModal(true)}
    className="sm:flex-none px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 active:from-purple-800 active:to-pink-800 transition-all shadow-md flex items-center justify-center gap-2"
  >
    <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5 rotate-45" />
    <span className="hidden sm:inline">Transfer</span>
  </button>
  <button
    onClick={() => setShowModal(true)}
    className="sm:flex-none px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-lg hover:from-indigo-700 hover:to-cyan-700 active:from-indigo-800 active:to-cyan-800 transition-all shadow-md flex items-center justify-center gap-2"
  >
    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
    <span className="hidden sm:inline">Tambah Transaksi</span>
  </button>
</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Waktu</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Keterangan</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Kas Masuk</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Kas Keluar</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Saldo Kas Ini</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransaksi.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Belum ada transaksi hari ini
                    </td>
                  </tr>
                ) : (
                  filteredTransaksi.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-800">{t.waktu}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          t.jenis === 'masuk' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {t.jenis === 'masuk' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                          {t.kategori}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.keterangan}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                        {t.jenis === 'masuk' ? formatCurrency(t.jumlah) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                        {t.jenis === 'keluar' ? formatCurrency(t.jumlah) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                        {formatCurrency(t.saldo_setelah)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Form */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-xl font-bold text-gray-800">Tambah Transaksi Kas</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Pilih Kas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Kas
                  </label>
                  <select
                    value={formData.kas_id}
                    onChange={(e) => setFormData({ ...formData, kas_id: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    {kasList.map(kas => (
                      <option key={kas.id} value={kas.id}>
                        {kas.nama_kas} (Saldo: {formatCurrency(kas.saldo)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis Transaksi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jenis Transaksi
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, jenis: 'masuk', kategori: '' })}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        formData.jenis === 'masuk'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-green-300'
                      }`}
                    >
                      <ArrowUpCircle className="w-5 h-5" />
                      Kas Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, jenis: 'keluar', kategori: '' })}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        formData.jenis === 'keluar'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-300 hover:border-red-300'
                      }`}
                    >
                      <ArrowDownCircle className="w-5 h-5" />
                      Kas Keluar
                    </button>
                  </div>
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    value={formData.kategori}
                    onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {(formData.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keterangan
                  </label>
                  <textarea
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                    placeholder="Contoh: Penjualan paket A ke Bu Siti"
                    required
                  />
                </div>

                {/* Jumlah */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    value={formData.jumlah}
                    onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="100"
                    required
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-lg hover:from-indigo-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Transfer */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl">
                <h3 className="text-xl font-bold">Transfer Antar Kas</h3>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransfer} className="p-6 space-y-4">
                {/* Dari Kas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dari Kas
                  </label>
                  <select
                    value={transferData.dari_kas_id}
                    onChange={(e) => {
                      const newDariKas = Number(e.target.value);
                      // Auto-pilih kas lain untuk "Ke Kas"
                      const kasLainnya = kasList.find(k => k.id !== newDariKas);
                      setTransferData({ 
                        ...transferData, 
                        dari_kas_id: newDariKas,
                        ke_kas_id: kasLainnya?.id || newDariKas
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    {kasList.map(kas => (
                      <option key={kas.id} value={kas.id}>
                        {kas.nama_kas} (Saldo: {formatCurrency(kas.saldo)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ke Kas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ke Kas
                  </label>
                  <select
                    value={transferData.ke_kas_id}
                    onChange={(e) => setTransferData({ ...transferData, ke_kas_id: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    {kasList
                      .filter(kas => kas.id !== transferData.dari_kas_id)
                      .map(kas => (
                        <option key={kas.id} value={kas.id}>
                          {kas.nama_kas} (Saldo: {formatCurrency(kas.saldo)})
                        </option>
                      ))}
                    {kasList.filter(kas => kas.id !== transferData.dari_kas_id).length === 0 && (
                      <option value="">Tidak ada kas lain tersedia</option>
                    )}
                  </select>
                </div>

                {/* Jumlah Transfer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Transfer
                  </label>
                  <input
                    type="number"
                    value={transferData.jumlah}
                    onChange={(e) => setTransferData({ ...transferData, jumlah: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="100"
                    required
                  />
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keterangan
                  </label>
                  <textarea
                    value={transferData.keterangan}
                    onChange={(e) => setTransferData({ ...transferData, keterangan: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Contoh: Transfer untuk operasional toko"
                    required
                  />
                </div>

                {/* Info Box */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ArrowDownCircle className="w-5 h-5 text-purple-600 mt-0.5 rotate-45" />
                    <div className="text-sm text-purple-800">
                      <p className="font-medium mb-1">Transfer akan mencatat 2 transaksi:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Kas keluar dari {kasList.find(k => k.id === transferData.dari_kas_id)?.nama_kas}</li>
                        <li>Kas masuk ke {kasList.find(k => k.id === transferData.ke_kas_id)?.nama_kas}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Memproses...' : 'Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
