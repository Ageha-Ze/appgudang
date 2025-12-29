'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Edit, Package, Calendar, User, MapPin, CreditCard, TrendingUp, Wallet, ShoppingBag, Receipt, CheckCircle, Clock } from 'lucide-react';
import { usePermissions, ReadOnlyBanner } from '@/components/PermissionGuard';
import PermissionGuard from '@/components/PermissionGuard';
import ModalTambahBarang from '../ModalTambahBarang';
import ModalBilling from '../ModalBilling';
import ModalEditBarangPembelian from '../ModalEditBarangPembelian';
import ModalCicil from '../ModalCicil';
import ModalEditCicil from '../ModalEditCicil';
import ModalPelunasan from '../ModalPelunasan';
import ModalEditDataPembelian from '../ModalEditDataPembelian';
import ModalEditUangMuka from '../ModalEditUangMuka';


interface DetailPembelian {
  id: number;
  produk_id: number;
  jumlah: number;
  jumlah_box: number;
  harga: number;
  subtotal: number;
  produk?: {
    id: number;
    nama_produk: string;
    kode_produk: string;
  };
}

interface PembelianData {
  id: number;
  tanggal: string;
  nota_supplier: string;
  jenis_pembayaran: string;
  total: number;
  uang_muka: number;
  biaya_kirim: number;
  status: string;
  status_barang: string;
  status_pembayaran: string;
  rekening_bayar?: string;
  cabang_id?: number;
  suplier?: {
    id: number;
    nama: string;
  };
  cabang?: {
    id: number;
    nama_cabang: string;
  };
  detail_pembelian?: DetailPembelian[];
}

interface CicilanItem {
  id: number;
  tanggal_cicilan: string;
  jumlah_cicilan: string | number;
  rekening?: string;
  type: string;
  keterangan?: string;
}

export default function DetailPembelianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [pembelian, setPembelian] = useState<PembelianData | null>(null);
  const [historyCicilan, setHistoryCicilan] = useState<CicilanItem[]>([]);
  const [hutangData, setHutangData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModalEditCicil, setShowModalEditCicil] = useState(false); // ✅ Tambah ini
  const [selectedCicilan, setSelectedCicilan] = useState<CicilanItem | null>(null); // ✅ Tambah ini
  const [showModalBarang, setShowModalBarang] = useState(false);
  const [showModalBilling, setShowModalBilling] = useState(false);
  const [showModalEditBarang, setShowModalEditBarang] = useState(false);
  const [showModalCicil, setShowModalCicil] = useState(false);
  const [showModalLunas, setShowModalLunas] = useState(false);
  const [showModalEditPembelian, setShowModalEditPembelian] = useState(false);
  const [showModalEditUangMuka, setShowModalEditUangMuka] = useState(false);
  const [loadingDeleteCicilan, setLoadingDeleteCicilan] = useState(false);
  const [loadingTerimaBarang, setLoadingTerimaBarang] = useState(false); // ✅ Tambah ini

  const [selectedDetail, setSelectedDetail] = useState<DetailPembelian | null>(null);

  // Permission guards - Only gidang and admin can manage purchases after billing
  const permissions = usePermissions({
    canView: 'purchase.read',
    canCreate: 'purchase.manage',
    canEdit: 'purchase.manage',
    canManage: 'purchase.manage',
  });

  const isReadOnly = permissions.canView && !permissions.canManage;

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const fetchHutangData = async () => {
    try {
      const res = await fetch(`/api/transaksi/pembelian/${id}/hutang`);
      const json = await res.json();
      if (res.ok && json.data) {
        setHutangData(json.data);
      }
    } catch (error) {
      console.error('Error fetching hutang data:', error);
    }
  };

  const fetchDetail = async (retryCount = 0) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/pembelian/${id}`);
      const json = await res.json();
      
      if (res.ok && json.data) {
        setPembelian(json.data);
        if (json.data.status !== 'pending') {
          fetchHistoryCicilan();
        }
      } else if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchDetail(1);
      }
    } catch (error) {
      console.error('Error fetching detail:', error);
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return fetchDetail(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryCicilan = async () => {
    try {
      const res = await fetch(`/api/transaksi/pembelian/${id}/cicilan`);
      const json = await res.json();
      if (res.ok) setHistoryCicilan(json.data || []);

      // Also fetch hutang data for accurate payment calculation
      await fetchHutangData();
    } catch (error) {
      console.error('Error fetching history cicilan:', error);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus barang ini?')) return;
    try {
      const res = await fetch(`/api/transaksi/pembelian/${id}/items?itemId=${itemId}&pembelianId=${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Item berhasil dihapus');
        fetchDetail();
      } else alert('Gagal menghapus item');
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

   const handleEditCicilan = (cicilan: CicilanItem) => {
    setSelectedCicilan(cicilan);
    setShowModalEditCicil(true);
  };

  const handleBatal = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pembelian ini? Semua item akan dihapus.')) return;
    try {
      const res = await fetch(`/api/transaksi/pembelian/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Pembelian berhasil dibatalkan');
        router.push('/transaksi/pembelian');
      } else {
        const json = await res.json();
        alert('Gagal membatalkan: ' + (json.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const handleDiterima = async () => {
  if (!confirm('Konfirmasi barang sudah diterima? Stok akan otomatis ditambahkan.')) return;
  
  setLoadingTerimaBarang(true); // ✅ Show loading
  
  try {
    const res = await fetch(`/api/transaksi/pembelian/${id}/terima`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    
    setLoadingTerimaBarang(false); // ✅ Hide loading before alert
    
    if (res.ok) {
      alert('Status barang berhasil diupdate dan stok telah ditambahkan');
      fetchDetail();
    } else {
      alert('Gagal update status: ' + (json.error || 'Unknown error'));
    }
  } catch (error: any) {
    setLoadingTerimaBarang(false); // ✅ Hide loading before alert
    alert('Terjadi kesalahan: ' + error.message);
  }
};

  const handleEditBarang = (detail: DetailPembelian) => {
    setSelectedDetail(detail);
    setShowModalEditBarang(true);
  };

  const handleDeleteCicilan = async (cicilanId: number) => {
    if (!confirm('Hapus cicilan ini? Saldo kas akan dikembalikan.')) return;
    setLoadingDeleteCicilan(true);
    try {
      const res = await fetch(`/api/transaksi/pembelian/${id}/cicilan?cicilanId=${cicilanId}&pembelianId=${id}`, { method: 'DELETE' });
      const json = await res.json();
      setLoadingDeleteCicilan(false); // Hide spinner before showing alert
      if (res.ok) {
        alert('Cicilan berhasil dihapus dan saldo kas dikembalikan');
        fetchDetail();
      } else alert('Gagal menghapus cicilan: ' + json.error);
    } catch (error) {
      setLoadingDeleteCicilan(false); // Hide spinner before showing alert
      alert('Gagal menghapus cicilan');
    }
  };

  const calculateSubtotal = () => pembelian?.detail_pembelian?.reduce((sum, d) => sum + d.subtotal, 0) || 0;
  const calculateTotal = () => pembelian ? calculateSubtotal() + pembelian.biaya_kirim : 0;
  const calculateTotalDibayar = () => historyCicilan.reduce((sum, c) => sum + parseFloat(c.jumlah_cicilan.toString() || '0'), 0);
  const calculateTagihan = () => Math.max(0, calculateTotal() - calculateTotalDibayar());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!pembelian) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Data tidak ditemukan</p>
        </div>
      </div>
    );
  }

  const isPending = pembelian.status === 'pending';
  const isBilled = pembelian.status !== 'pending';
  const isLunas = pembelian.status_pembayaran === 'Lunas';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10"></div>
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/transaksi/pembelian')}
                className="group p-3 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Transaksi</p>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Detail Pembelian
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl text-white shadow-lg">
              <Receipt className="w-5 h-5" />
              <span className="font-bold text-lg">{pembelian.nota_supplier}</span>
            </div>
          </div>
        </div>

        {/* Read-only banner for keuangan users */}
        {isReadOnly && <ReadOnlyBanner />}

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Tanggal</p>
            </div>
            <p className="text-lg font-bold text-gray-800">{new Date(pembelian.tanggal).toLocaleDateString('id-ID')}</p>
          </div>

          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                <User className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Supplier</p>
            </div>
            <p className="text-lg font-bold text-gray-800">{pembelian.suplier?.nama || '-'}</p>
          </div>

          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl group-hover:scale-110 transition-transform">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Kantor</p>
            </div>
            <p className="text-lg font-bold text-gray-800">{pembelian.cabang?.nama_cabang || '-'}</p>
          </div>

          <div className="group bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg border border-white/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl group-hover:scale-110 transition-transform ${
                isLunas ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Status</p>
            </div>
            <p className={`text-lg font-bold ${isLunas ? 'text-green-600' : 'text-red-600'}`}>
              {pembelian.status_pembayaran}
            </p>
          </div>
        </div>

        {/* Status Barang - Compact */}
        {isBilled && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl p-5 border border-amber-200/50 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${pembelian.status_barang === 'Diterima' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status Barang</p>
                  <span className={`px-4 py-1.5 rounded-lg font-semibold text-sm shadow-md ${
                    pembelian.status_barang === 'Diterima'
                      ? 'bg-green-500 text-white'
                      : 'bg-yellow-500 text-white'
                  }`}>
                    {pembelian.status_barang}
                  </span>
                </div>
              </div>
              {pembelian.status_barang !== 'Diterima' && (
                <button
                  onClick={handleDiterima}
                  disabled={loadingTerimaBarang} // ✅ Disable saat loading
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-xl transition-all duration-300 hover:scale-105 font-medium"
                >
                  <CheckCircle className="w-5 h-5" />
                  Terima Barang
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detail Barang */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Detail Barang</h2>
              </div>
              {isPending && (
                <button
                  onClick={() => {
    setShowModalBarang(true);
  }}
                  className="px-5 py-2.5 bg-white text-purple-600 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 font-semibold"
                >
                  + Tambah Barang
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kode</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Barang</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Harga</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Qty</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Box</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Subtotal</th>
                  {(isPending || isBilled) && <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pembelian.detail_pembelian && pembelian.detail_pembelian.length > 0 ? (
                  pembelian.detail_pembelian.map((detail, index) => (
                    <tr key={detail.id} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600">{detail.produk?.kode_produk || '-'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{detail.produk?.nama_produk || '-'}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">Rp {detail.harga.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{parseFloat(detail.jumlah.toString()).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{detail.jumlah_box || 0}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-800">Rp {detail.subtotal.toLocaleString('id-ID')}</td>
                      {(isPending || isBilled) && (
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {permissions.canManage && (
                              <button
                                onClick={() => handleEditBarang(detail)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {isPending && permissions.canManage && (
                              <button
                                onClick={() => handleDeleteItem(detail.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isPending || isBilled ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>Belum ada barang</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards for Detail Barang */}
          <div className="lg:hidden space-y-4 p-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Memuat data...</p>
              </div>
            ) : pembelian.detail_pembelian && pembelian.detail_pembelian.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Belum ada barang</p>
              </div>
            ) : (
              pembelian.detail_pembelian?.map((detail, index) => (
                <div key={detail.id} className="bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs text-violet-100 mb-1">📋 Kode</p>
                        <p className="font-mono text-base font-bold">{detail.produk?.kode_produk || '-'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-400 text-green-900">
                          Qty: {parseFloat(detail.jumlah.toString()).toFixed(2)}
                        </span>
                        {detail.jumlah_box > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-400 text-blue-900">
                            Box: {detail.jumlah_box}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">📦</span>
                        <div className="flex-1">
                          <p className="text-xs text-violet-100">Nama Produk</p>
                          <p className="text-sm font-semibold">{detail.produk?.nama_produk || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-base">💰</span>
                        <div>
                          <p className="text-xs text-violet-100">Harga</p>
                          <p className="text-sm font-semibold">Rp. {detail.harga.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-4"></div>

                    {/* Subtotal */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-violet-100">Subtotal</span>
                      <span className="text-xl font-bold">Rp. {detail.subtotal.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Action Buttons */}
                    {(isPending || isBilled) && (
                      <div className="flex gap-2">
                        {permissions.canManage && (
                          <button
                            onClick={() => handleEditBarang(detail)}
                            className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                        )}
                        {isPending && permissions.canManage && (
                          <button
                            onClick={() => handleDeleteItem(detail.id)}
                            className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl p-4 shadow-md">
                <p className="text-sm text-gray-600 mb-1">Subtotal</p>
                <p className="text-xl font-bold text-gray-800">Rp {calculateSubtotal().toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-md">
                <p className="text-sm text-gray-600 mb-1">Biaya Kirim</p>
                <p className="text-xl font-bold text-gray-800">Rp {pembelian.biaya_kirim.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 shadow-lg">
                <p className="text-sm text-purple-100 mb-1">Total</p>
                <p className="text-2xl font-bold text-white">Rp {calculateTotal().toLocaleString('id-ID')}</p>
              </div>
            </div>

            {isBilled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-5 h-5 text-blue-600" />
                    <p className="text-sm text-blue-700 font-medium">Uang Muka</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">Rp {pembelian.uang_muka.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-red-600" />
                    <p className="text-sm text-red-700 font-medium">Sisa Tagihan</p>
                  </div>
                  <p className="text-xl font-bold text-red-600">Rp {calculateTagihan().toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 bg-white flex flex-wrap gap-3 justify-center border-t border-gray-200">
            {!isBilled ? (
              <>
                {permissions.canManage && (
                  <button
                    onClick={() => setShowModalBilling(true)}
                    disabled={!pembelian.detail_pembelian || pembelian.detail_pembelian.length === 0}
                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  >
                    Billing Sekarang
                  </button>
                )}
                {permissions.canManage && (
                  <button
                    onClick={handleBatal}
                    className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Batalkan
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push('/transaksi/pembelian')}
                  className="px-6 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600 transition-all"
                >
                  Kembali
                </button>
                {!isLunas && permissions.canManage && (
                  <>
                    <button
                      onClick={() => setShowModalCicil(true)}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                    >
                      Cicil
                    </button>
                    <button
                      onClick={() => setShowModalLunas(true)}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                    >
                      Lunasi
                    </button>
                  </>
                )}
                {permissions.canManage && (
                  <button
                    onClick={() => setShowModalEditPembelian(true)}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Edit Data
                  </button>
                )}
                {permissions.canManage && (
                  <button
                    onClick={() => setShowModalEditUangMuka(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105"
                  >
                    Edit Biaya
                  </button>
                )}
              </>
            )}
          </div>
        </div>
    {/* History Cicilan */}
    {isBilled && historyCicilan.length > 0 && (
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
        <h2 className="font-bold text-base md:text-lg mb-4 md:mb-6 underline text-center">History Cicilan Pembelian</h2>

        {/* Summary Hutang */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 p-4 md:p-6 bg-blue-50 rounded-md">
          <div className="text-center">
            <label className="block text-xs md:text-sm text-gray-600 mb-2">Total Hutang</label>
            <div className="text-lg md:text-xl font-semibold">
              Rp. {calculateTotal().toLocaleString('id-ID')}
            </div>
          </div>
          <div className="text-center">
            <label className="block text-xs md:text-sm text-gray-600 mb-2">Sudah Dibayar</label>
            <div className="text-lg md:text-xl font-semibold text-green-600">
              Rp. {(hutangData?.dibayar || calculateTotalDibayar()).toLocaleString('id-ID')}
            </div>
          </div>
          <div className="text-center">
            <label className="block text-xs md:text-sm text-gray-600 mb-2">Sisa Hutang</label>
            <div className="text-lg md:text-xl font-semibold text-red-600">
              Rp. {(hutangData ? (hutangData.total_hutang - hutangData.dibayar) : calculateTagihan()).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left border border-gray-200 text-xs md:text-sm">No</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left border border-gray-200 text-xs md:text-sm">Tanggal Cicilan</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left border border-gray-200 text-xs md:text-sm">Rekening</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left border border-gray-200 text-xs md:text-sm">Type</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-right border border-gray-200 text-xs md:text-sm">Jumlah Cicilan</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left border border-gray-200 text-xs md:text-sm">Keterangan</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-center border border-gray-200 text-xs md:text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyCicilan.map((item, index) => (
                  <tr key={item.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                    <td className="px-2 md:px-4 py-2 md:py-3 border border-gray-200 text-xs md:text-sm">{index + 1}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 border border-gray-200 text-xs md:text-sm">
                      {new Date(item.tanggal_cicilan).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 border border-gray-200 text-xs md:text-sm">{item.rekening || '-'}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 border border-gray-200">
                      <span
                        className={`px-2 md:px-3 py-1 rounded-full text-xs font-medium ${
                          item.type === 'pelunasan'
                            ? 'bg-green-100 text-green-800'
                            : item.type === 'cicilan'
                            ? 'bg-blue-100 text-blue-800'
                            : item.type === 'uang_muka'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.type === 'pelunasan'
                          ? 'Pelunasan'
                          : item.type === 'cicilan'
                          ? 'Cicilan'
                          : item.type === 'uang_muka'
                          ? 'Uang Muka'
                          : item.type}
                      </span>
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-right border border-gray-200 text-xs md:text-sm">
                      Rp. {parseFloat(item.jumlah_cicilan.toString()).toLocaleString('id-ID')}
                    </td>
                    <td className="px-2 md:px-4 py-2 md:py-3 border border-gray-200 text-xs md:text-sm">{item.keterangan || '-'}</td>
                    <td className="px-2 md:px-4 py-2 md:py-3 text-center border border-gray-200">
                      <div className="flex justify-center gap-1 md:gap-2">
                        {!isLunas && item.type !== 'pelunasan' && permissions.canManage ? (
                          <>
                            <button
                                  onClick={() => handleEditCicilan(item)}
                                  className="text-blue-600 hover:text-blue-800 transition p-1"
                                  title="Edit"
                                >
                                  <Edit size={16} className="md:w-[18px] md:h-[18px]" />
                                </button>
                            <button
                              onClick={() => handleDeleteCicilan(item.id)}
                              className="text-red-600 hover:text-red-800 transition p-1"
                              title="Hapus"
                            >
                              <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={4} className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm">
                    Total Cicilan:
                  </td>
                  <td className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm">
                    Rp.{' '}
                    {historyCicilan
                      .reduce((sum, c) => sum + parseFloat(c.jumlah_cicilan.toString()), 0)
                      .toLocaleString('id-ID')}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards for History Cicilan */}
        <div className="lg:hidden space-y-4">
          {historyCicilan.map((item, index) => (
            <div key={item.id} className="bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Header with Cicilan # */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-cyan-100 mb-1">Cicilan #{index + 1}</p>
                    <p className="font-mono text-base font-bold">{new Date(item.tanggal_cicilan).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.type === 'pelunasan' ? 'bg-green-400 text-green-900' :
                      item.type === 'cicilan' ? 'bg-blue-400 text-blue-900' :
                      item.type === 'uang_muka' ? 'bg-purple-400 text-purple-900' :
                      'bg-gray-400 text-gray-900'
                    }`}>
                      {item.type === 'pelunasan' ? 'Pelunasan' :
                       item.type === 'cicilan' ? 'Cicilan' :
                       item.type === 'uang_muka' ? 'Uang Muka' :
                       item.type}
                    </span>
                  </div>
                </div>

                {/* Cicilan Info */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🏦</span>
                    <div className="flex-1">
                      <p className="text-xs text-cyan-100">Rekening</p>
                      <p className="text-sm font-semibold">{item.rekening || '-'}</p>
                    </div>
                  </div>

                  {item.keterangan && (
                    <div className="flex items-start gap-2">
                      <span className="text-lg">📝</span>
                      <div className="flex-1">
                        <p className="text-xs text-cyan-100">Keterangan</p>
                        <p className="text-sm font-semibold">{item.keterangan}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/20 my-4"></div>

                {/* Amount */}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-cyan-100">Jumlah Cicilan</span>
                  <span className="text-2xl font-bold">
                    Rp. {parseFloat(item.jumlah_cicilan.toString()).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Action Buttons */}
                {!isLunas && item.type !== 'pelunasan' && permissions.canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditCicilan(item)}
                      className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCicilan(item.id)}
                      className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Modals */}
    <ModalTambahBarang
      isOpen={showModalBarang}
      onClose={() => setShowModalBarang(false)}
      onSuccess={fetchDetail}
      pembelianId={parseInt(id)}
    />

    <ModalBilling
      isOpen={showModalBilling}
      onClose={() => setShowModalBilling(false)}
      onSuccess={fetchDetail}
      pembelianData={pembelian}
    />

    {selectedDetail && (
      <ModalEditBarangPembelian
        isOpen={showModalEditBarang}
        onClose={() => {
          setShowModalEditBarang(false);
          setSelectedDetail(null);
        }}
        onSuccess={fetchDetail}
        detail={selectedDetail}
        pembelianId={parseInt(id)}
      />
    )}

    <ModalCicil
      isOpen={showModalCicil}
      onClose={() => setShowModalCicil(false)}
      onSuccess={fetchDetail}
      pembelianId={parseInt(id)}
      sisaTagihan={calculateTagihan()}
      cabangId={pembelian?.cabang_id}
    />
    {/* ✅ Tambahkan Modal Edit Cicilan */}
        {selectedCicilan && (
          <ModalEditCicil
            isOpen={showModalEditCicil}
            onClose={() => {
              setShowModalEditCicil(false);
              setSelectedCicilan(null);
            }}
            onSuccess={fetchDetail}
            pembelianId={parseInt(id)}
            sisaTagihan={calculateTagihan()}
            cabangId={pembelian?.cabang_id}
            editingCicilan={selectedCicilan}
          />
        )}
    <ModalPelunasan
      isOpen={showModalLunas}
      onClose={() => setShowModalLunas(false)}
      onSuccess={fetchDetail}
      pembelianId={parseInt(id)}
      sisaTagihan={calculateTagihan()}
      cabangId={pembelian?.cabang_id}
    />

    <ModalEditDataPembelian
      isOpen={showModalEditPembelian}
      onClose={() => setShowModalEditPembelian(false)}
      onSuccess={fetchDetail}
      pembelianData={pembelian}
    />

    <ModalEditUangMuka
      isOpen={showModalEditUangMuka}
      onClose={() => setShowModalEditUangMuka(false)}
      onSuccess={fetchDetail}
      pembelianId={parseInt(id)}
      cabangId={pembelian?.cabang_id}
      currentData={{
        uang_muka: pembelian.uang_muka,
        biaya_kirim: pembelian.biaya_kirim,
        rekening_bayar: pembelian.rekening_bayar,
      }}
    />

    {/* Loading Overlay for Delete Cicilan */}
{loadingDeleteCicilan && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
    <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-800">Menghapus Cicilan...</p>
        <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
      </div>
    </div>
  </div>
)}
{/* ✅ Loading Overlay for Terima Barang */}
{loadingTerimaBarang && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
    <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-800">Menerima Barang...</p>
        <p className="text-sm text-gray-600">Stok sedang diperbarui, mohon tunggu</p>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}
