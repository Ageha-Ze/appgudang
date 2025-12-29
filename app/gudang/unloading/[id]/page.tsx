'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Package, ArrowLeft, Calendar, Building, FileText, Box } from 'lucide-react';

interface UnloadingDetail {
  tanggal: string;
  cabang_id: number;
  cabang: {
    nama_cabang: string;
    kode_cabang: string;
  };
  keterangan?: string;
  items: {
    id: number;
    produk_jerigen_id: number;
    produk_kiloan_id: number;
    jumlah: number;
    keterangan?: string;
    produk_jerigen: {
      nama_produk: string;
      kode_produk: string;
      satuan: string;
      stok: number;
    };
    produk_kiloan: {
      nama_produk: string;
      kode_produk: string;
      satuan: string;
      stok: number;
    };
  }[];
  total_qty: number;
  jumlah_item: number;
}

export default function DetailUnloadingPage() {
  const router = useRouter();
  const params = useParams();
  const unloadingId = params.id;

  const [data, setData] = useState<UnloadingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unloadingId) {
      fetchData();
    }
  }, [unloadingId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/gudang/unloading/${unloadingId}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.error) {
        throw new Error(json.error);
      }
      
      setData(json.data);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium text-sm">Memuat data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <div className="text-red-500 mb-4">
            <Package size={48} className="mx-auto" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Package size={48} className="mx-auto" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Data tidak ditemukan</h2>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-8 bg-white p-3 sm:p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => router.back()}
            className="p-1.5 sm:p-2 hover:bg-indigo-100 rounded-lg transition flex-shrink-0"
          >
            <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
          </button>
          <div className="bg-indigo-500 p-2 sm:p-3 rounded-lg flex-shrink-0">
            <Package className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-indigo-600">Detail Unloading</p>
            <h1 className="text-sm sm:text-2xl font-bold text-indigo-700 truncate">
              {new Date(data.tanggal).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </h1>
          </div>
        </div>
      </div>

      {/* Info Unloading */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
          <FileText size={18} className="sm:w-5 sm:h-5" />
          Informasi Unloading
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <Calendar className="text-indigo-600 mt-1 flex-shrink-0" size={18} />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Tanggal Unloading</p>
              <p className="font-medium text-sm sm:text-lg break-words">
                {new Date(data.tanggal).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <Building className="text-indigo-600 mt-1 flex-shrink-0" size={18} />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Cabang</p>
              <p className="font-medium text-sm sm:text-lg break-words">
                {data.cabang.nama_cabang}
              </p>
              <p className="text-xs text-gray-500">{data.cabang.kode_cabang}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 sm:gap-3">
            <Box className="text-green-600 mt-1 flex-shrink-0" size={18} />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">Total Quantity</p>
              <p className="font-medium text-sm sm:text-lg text-green-600">
                {data.total_qty.toFixed(2)} kg
              </p>
              <p className="text-xs text-gray-500">{data.jumlah_item} item produk</p>
            </div>
          </div>
        </div>

        {data.keterangan && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-indigo-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Keterangan:</p>
            <p className="font-medium text-sm sm:text-base break-words">{data.keterangan}</p>
          </div>
        )}
      </div>

      {/* Detail Barang - Mobile Cards */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">Detail Unloading</h2>
        
        {/* Mobile View */}
        <div className="block sm:hidden space-y-3">
          {data.items.map((item, index) => (
            <div key={item.id} className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                  #{index + 1}
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {item.jumlah.toFixed(2)} kg
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="bg-white p-2 rounded border border-indigo-200">
                  <div className="text-xs text-gray-500 mb-1">Dari (Jerigen)</div>
                  <div className="font-medium text-sm">{item.produk_jerigen?.nama_produk || '-'}</div>
                  <div className="text-xs text-gray-500">
                    {item.produk_jerigen?.kode_produk || '-'} | Stock: {item.produk_jerigen?.stok || 0}
                  </div>
                </div>
                
                <div className="text-center">
                  <span className="text-indigo-600 font-bold">↓</span>
                </div>
                
                <div className="bg-white p-2 rounded border border-indigo-200">
                  <div className="text-xs text-gray-500 mb-1">Ke (Kiloan)</div>
                  <div className="font-medium text-sm">{item.produk_kiloan?.nama_produk || '-'}</div>
                  <div className="text-xs text-gray-500">
                    {item.produk_kiloan?.kode_produk || '-'} | Stock: {item.produk_kiloan?.stok || 0}
                  </div>
                </div>
              </div>
              
              {item.keterangan && (
                <div className="mt-2 pt-2 border-t border-indigo-200">
                  <p className="text-xs text-gray-600">{item.keterangan}</p>
                </div>
              )}
            </div>
          ))}
          
          <div className="bg-indigo-100 p-3 rounded-lg font-bold">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total:</span>
              <span className="text-green-600 text-base">{data.total_qty.toFixed(2)} kg</span>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-indigo-100">
              <tr>
                <th className="px-4 py-3 text-left border border-indigo-200">No</th>
                <th className="px-4 py-3 text-left border border-indigo-200">Produk Jerigen (Sumber)</th>
                <th className="px-4 py-3 text-center border border-indigo-200">→</th>
                <th className="px-4 py-3 text-left border border-indigo-200">Produk Kiloan (Tujuan)</th>
                <th className="px-4 py-3 text-right border border-indigo-200">Jumlah</th>
                <th className="px-4 py-3 text-left border border-indigo-200">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={item.id} className={`border-b border-indigo-200 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'
                } hover:bg-indigo-100`}>
                  <td className="px-4 py-3 border border-indigo-200 text-center font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <div>
                      <div className="font-medium">{item.produk_jerigen?.nama_produk || '-'}</div>
                      <div className="text-xs text-gray-500">
                        {item.produk_jerigen?.kode_produk || '-'} | Stock: {item.produk_jerigen?.stok || 0} {item.produk_jerigen?.satuan || ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center border border-indigo-200">
                    <span className="text-indigo-600 font-bold text-lg">→</span>
                  </td>
                  <td className="px-4 py-3 border border-indigo-200">
                    <div>
                      <div className="font-medium">{item.produk_kiloan?.nama_produk || '-'}</div>
                      <div className="text-xs text-gray-500">
                        {item.produk_kiloan?.kode_produk || '-'} | Stock: {item.produk_kiloan?.stok || 0} {item.produk_kiloan?.satuan || ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right border border-indigo-200 font-semibold text-green-600">
                    {item.jumlah.toFixed(2)} kg
                  </td>
                  <td className="px-4 py-3 border border-indigo-200 text-gray-600 text-sm">
                    {item.keterangan || '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-indigo-100 font-bold">
                <td colSpan={4} className="px-4 py-3 text-right border border-indigo-200">
                  Total:
                </td>
                <td className="px-4 py-3 text-right border border-indigo-200 text-green-600 text-lg">
                  {data.total_qty.toFixed(2)} kg
                </td>
                <td className="border border-indigo-200"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
          <p className="text-xs sm:text-sm text-green-700 mb-1">Total Diunload</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {data.total_qty.toFixed(2)}
          </p>
          <p className="text-xs text-green-600 mt-1">kg</p>
        </div>

        <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <p className="text-xs sm:text-sm text-blue-700 mb-1">Jumlah Item</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
            {data.jumlah_item}
          </p>
          <p className="text-xs text-blue-600 mt-1">jenis produk</p>
        </div>

        <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <p className="text-xs sm:text-sm text-purple-700 mb-1">Status</p>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">
            ✅ Selesai
          </p>
          <p className="text-xs text-purple-600 mt-1">Stock sudah diupdate</p>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={() => router.push('/gudang/unloading')}
          className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Kembali ke List
        </button>
      </div>
    </div>
  );
}
