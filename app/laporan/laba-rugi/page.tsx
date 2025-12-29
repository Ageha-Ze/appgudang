'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Cabang {
  id: number;
  nama_cabang: string;
}
 
export default function LabaRugiPage() {
  const [tanggalDari, setTanggalDari] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [tanggalSampai, setTanggalSampai] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [cabangId, setCabangId] = useState('');
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCabang();
  }, []);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleGenerate = async () => {
    if (!tanggalDari || !tanggalSampai) {
      alert('Tanggal dari dan sampai wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        tanggal_dari: tanggalDari,
        tanggal_sampai: tanggalSampai,
      });
      
      if (cabangId) params.append('cabang_id', cabangId);

      const res = await fetch(`/api/laporan/laba-rugi?${params}`);
      const json = await res.json();

      if (res.ok) {
        setData(json);
      } else {
        alert(json.error || 'Gagal generate laporan');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="bg-indigo-500 p-3 rounded-lg">
          <DollarSign className="text-white" size={24} />
        </div>
        <div>
          <p className="text-sm text-indigo-600">Laporan</p>
          <h1 className="text-2xl font-bold text-indigo-700">Laba / Rugi</h1>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Filter Periode</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Tanggal Dari</label>
            <input
              type="date"
              value={tanggalDari}
              onChange={(e) => setTanggalDari(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Tanggal Sampai</label>
            <input
              type="date"
              value={tanggalSampai}
              onChange={(e) => setTanggalSampai(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-2">Cabang (Opsional)</label>
            <select
              value={cabangId}
              onChange={(e) => setCabangId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Cabang</option>
              {cabangList.map((cabang) => (
                <option key={cabang.id} value={cabang.id}>
                  {cabang.nama_cabang}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Generate Laporan'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Ringkasan Pendapatan */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-600" size={24} />
              <h2 className="text-lg font-bold text-gray-800">Pendapatan</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Penjualan Normal</p>
                <p className="text-xl font-bold text-green-700">
                  {formatCurrency(data.pendapatan.penjualan_normal)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Penjualan Konsinyasi</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.pendapatan.penjualan_konsinyasi)}
                </p>
              </div>
              <div className="p-4 bg-indigo-100 rounded-lg border-2 border-indigo-500">
                <p className="text-sm text-gray-600 font-semibold">Total Pendapatan</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {formatCurrency(data.pendapatan.total)}
                </p>
              </div>
            </div>
          </div>

          {/* HPP */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="text-orange-600" size={24} />
              <h2 className="text-lg font-bold text-gray-800">Harga Pokok Penjualan (HPP)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">HPP Penjualan</p>
                <p className="text-xl font-bold text-orange-700">
                  {formatCurrency(data.hpp.hpp_penjualan)}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">HPP Konsinyasi</p>
                <p className="text-xl font-bold text-orange-700">
                  {formatCurrency(data.hpp.hpp_konsinyasi)}
                </p>
              </div>
              <div className="p-4 bg-orange-100 rounded-lg border-2 border-orange-500">
                <p className="text-sm text-gray-600 font-semibold">Total HPP</p>
                <p className="text-2xl font-bold text-orange-700">
                  {formatCurrency(data.hpp.total)}
                </p>
              </div>
            </div>
          </div>

          {/* Laba Kotor */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-blue-600" size={24} />
              <h2 className="text-lg font-bold text-gray-800">Laba Kotor</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Dari Penjualan</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.laba_kotor.dari_penjualan)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Dari Konsinyasi</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.laba_kotor.dari_konsinyasi)}
                </p>
              </div>
              <div className="p-4 bg-blue-100 rounded-lg border-2 border-blue-500">
                <p className="text-sm text-gray-600 font-semibold">Total Laba Kotor</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(data.laba_kotor.total)}
                </p>
              </div>
            </div>
          </div>

          {/* Biaya */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="text-red-600" size={24} />
              <h2 className="text-lg font-bold text-gray-800">Biaya Operasional</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Pengeluaran Kas</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.pengeluaran_kas)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Pembayaran Hutang</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.cicilan_hutang)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Biaya Kirim Pembelian</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.biaya_kirim_pembelian)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Biaya Potong Penjualan</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.biaya_potong)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">Diskon</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.diskon)}
                </p>
              </div>
              <div className="p-4 bg-red-100 rounded-lg border-2 border-red-500">
                <p className="text-sm text-gray-600 font-semibold">Total Biaya</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.biaya.total)}
                </p>
              </div>
            </div>
            
            {/* Info tambahan */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                ℹ️ <strong>Catatan:</strong> Biaya Ongkir Penjualan ({formatCurrency(data.biaya.biaya_ongkir_penjualan)}) 
                sudah termasuk dalam Pendapatan Penjualan (dibebankan ke customer)
              </p>
            </div>
          </div>

          {/* Laba Bersih */}
          <div className={`rounded-xl shadow-lg p-8 ${
            data.laba_bersih >= 0 ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}>
            <div className="text-center text-white">
              <p className="text-lg mb-2">
                {data.laba_bersih >= 0 ? '🎉 LABA BERSIH' : '⚠️ RUGI BERSIH'}
              </p>
              <p className="text-5xl font-bold mb-2">
                {formatCurrency(Math.abs(data.laba_bersih))}
              </p>
              <p className="text-sm opacity-90">
                Periode: {new Date(data.periode.dari).toLocaleDateString('id-ID')} - {new Date(data.periode.sampai).toLocaleDateString('id-ID')}
              </p>
              <p className="text-sm opacity-90 mt-1">
                📍 {data.cabang.nama_cabang}
              </p>
              <div className="mt-4 pt-4 border-t border-white/30 flex justify-center gap-8">
                <div>
                  <p className="text-xs opacity-80">Transaksi Penjualan</p>
                  <p className="text-xl font-bold">{data.detail.jumlah_transaksi_penjualan}</p>
                </div>
                <div>
                  <p className="text-xs opacity-80">Transaksi Konsinyasi</p>
                  <p className="text-xl font-bold">{data.detail.jumlah_transaksi_konsinyasi}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            Pilih periode dan klik "Generate Laporan" untuk melihat laba/rugi
          </p>
        </div>
      )}
    </div>
  );
}
