'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Package, Calendar, User, Building2, CheckCircle, XCircle, Edit } from 'lucide-react';
import ModalTambahKomposisi from './ModalTambahKomposisi';
import ModalEditKomposisi from './ModalEditKomposisi';
import ModalEditProduksi from './ModalEditProduksi';

interface DetailProduksi {
  id: number;
  item_id: number;
  jumlah: number;
  hpp: number;
  subtotal: number;
  item?: { nama_produk: string; satuan?: string };
}

interface ProduksiData {
  id: number;
  tanggal: string;
  produk_id: number;
  jumlah: number;
  satuan: string;
  pegawai_id: number;
  cabang_id: number;
  status: string;
  produk?: { nama_produk: string };
  pegawai?: { nama: string };
  cabang?: { nama_cabang: string };
  detail_produksi?: DetailProduksi[];
}

export default function DetailProduksiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [id, setId] = useState<string>('');
  const [produksi, setProduksi] = useState<ProduksiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModalKomposisi, setShowModalKomposisi] = useState(false);
  const [showModalEditKomposisi, setShowModalEditKomposisi] = useState(false);
  const [showModalEditProduksi, setShowModalEditProduksi] = useState(false);
  const [editingDetail, setEditingDetail] = useState<DetailProduksi | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/gudang/produksi/${id}`);
      const json = await res.json();
      if (res.ok) setProduksi(json.data);
    } catch (error) {
      console.error('Error fetching detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (detailId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    try {
      const res = await fetch(`/api/gudang/produksi/${id}/details?detailId=${detailId}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Item berhasil dihapus');
        fetchDetail();
      } else {
        alert('Gagal menghapus item');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePost = async () => {
    if (!confirm('Apakah Anda yakin ingin memposting produksi ini? Status akan diubah ke posted.')) return;
    try {
      const res = await fetch(`/api/gudang/produksi/${id}/post`, { method: 'POST' });
      if (res.ok) {
        alert('Produksi berhasil diposting');
        fetchDetail();
      } else {
        alert('Gagal memposting');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleCancel = async () => {
  if (!confirm('Apakah Anda yakin ingin membatalkan produksi ini? Semua detail akan dihapus.')) return;
  try {
    const res = await fetch(`/api/gudang/produksi/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('Produksi berhasil dibatalkan');
      router.push('/gudang/produksi');
    } else {
      const errorData = await res.json();
      alert(`Gagal membatalkan: ${errorData.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Terjadi kesalahan saat membatalkan produksi');
  }
};

  const calculateTotalSubtotal = () => {
    return produksi?.detail_produksi?.reduce((sum, d) => sum + d.subtotal, 0) || 0;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!produksi) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Data tidak ditemukan</p>
          <button
            onClick={() => router.push('/gudang/produksi')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const isPending = produksi.status === 'pending';
  const isPosted = produksi.status === 'posted';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push('/gudang/produksi')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Kembali</span>
      </button>

      {/* Main Card - Data Produksi */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">Detail Produksi</h3>
              <p className="text-blue-100 mt-1">Informasi lengkap produksi</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Desktop Edit Button */}
              {isPending && (
                <button
                  onClick={() => setShowModalEditProduksi(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-200 hidden sm:flex items-center gap-2"
                  title="Edit Produksi"
                >
                  <Edit size={16} />
                  <span>Edit</span>
                </button>
              )}
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                isPosted
                  ? 'bg-green-500 text-white'
                  : 'bg-yellow-400 text-yellow-900'
              }`}>
                {isPosted ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {produksi.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Mobile Edit Button - Below Status */}
          {isPending && (
            <div className="mt-4 sm:hidden">
              <button
                onClick={() => setShowModalEditProduksi(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 w-full justify-center"
                title="Edit Produksi"
              >
                <Edit size={16} />
                <span>Edit Produksi</span>
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Calendar size={16} />
                  Tanggal
                </label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                  {new Date(produksi.tanggal).toLocaleDateString('id-ID')}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Package size={16} />
                  Produk
                </label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                  {produksi.produk?.nama_produk || '-'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">Jumlah</label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                  {produksi.jumlah} {produksi.satuan}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <User size={16} />
                  Pegawai
                </label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                  {produksi.pegawai?.nama || '-'}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Building2 size={16} />
                  Cabang
                </label>
                <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 font-medium">
                  {produksi.cabang?.nama_cabang || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Komposisi Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">Komposisi Item</h3>
            {isPending && (
              <button
                onClick={() => setShowModalKomposisi(true)}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
              >
                + Tambah Item
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table / Mobile Cards */}
        <div className="p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Nama Item</th>
                  <th className="px-6 py-4 text-right font-semibold">Qty</th>
                  <th className="px-6 py-4 text-right font-semibold">COGS</th>
                  <th className="px-6 py-4 text-right font-semibold">Subtotal</th>
                  {isPending && <th className="px-6 py-4 text-center font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {produksi.detail_produksi && produksi.detail_produksi.length > 0 ? (
                  produksi.detail_produksi.map((detail, idx) => (
                    <tr
                      key={detail.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-colors duration-200`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                            {(detail.item?.nama_produk || 'I').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-gray-800 font-medium">{detail.item?.nama_produk || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">
                        {detail.jumlah} {detail.item?.satuan || 'unit'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700 font-medium">
                        Rp. {detail.hpp.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-800 font-bold">
                        Rp. {detail.subtotal.toLocaleString('id-ID')}
                      </td>
                      {isPending && (
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => {
                                setEditingDetail(detail);
                                setShowModalEditKomposisi(true);
                              }}
                              className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(detail.id)}
                              className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                              title="Hapus"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isPending ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                      Belum ada item komposisi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {produksi.detail_produksi && produksi.detail_produksi.length > 0 ? (
              produksi.detail_produksi.map((detail, idx) => (
                <div
                  key={detail.id}
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {(detail.item?.nama_produk || 'I').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-sm">{detail.item?.nama_produk || '-'}</h4>
                        <p className="text-xs text-gray-500">Item Komposisi</p>
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingDetail(detail);
                            setShowModalEditKomposisi(true);
                          }}
                          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(detail.id)}
                          className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-gray-500 mb-1">Quantity</p>
                      <p className="font-semibold text-gray-800">
                        {detail.jumlah} {detail.item?.satuan || 'unit'}
                      </p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-gray-500 mb-1">COGS</p>
                      <p className="font-semibold text-gray-800">Rp. {detail.hpp.toLocaleString('id-ID')}</p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-3 border border-blue-100 col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Subtotal</p>
                      <p className="font-bold text-lg text-blue-600">Rp. {detail.subtotal.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-medium">Belum ada item komposisi</p>
                <p className="text-sm">Tambahkan item untuk memulai produksi</p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mt-6 flex justify-end">
            <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-semibold">Total Subtotal:</span>
                <span className="text-xl font-bold text-gray-900">
                  Rp. {calculateTotalSubtotal().toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mt-8 justify-center">
            {isPending ? (
              <>
                <button
                  onClick={handlePost}
                  className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2"
                >
                  <CheckCircle size={20} />
                  Post Produksi
                </button>
                <button
                  onClick={handleCancel}
                  className="px-8 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2"
                >
                  <XCircle size={20} />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/gudang/produksi')}
                className="px-8 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                Kembali
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <ModalTambahKomposisi
        isOpen={showModalKomposisi}
        onClose={() => setShowModalKomposisi(false)}
        onSuccess={fetchDetail}
        produksiId={parseInt(id)}
        cabangId={produksi.cabang_id}
      />
      <ModalEditKomposisi
        isOpen={showModalEditKomposisi}
        onClose={() => {
          setShowModalEditKomposisi(false);
          setEditingDetail(null);
        }}
        onSuccess={fetchDetail}
        produksiId={parseInt(id)}
        cabangId={produksi.cabang_id}
        editingDetail={editingDetail}
      />
      <ModalEditProduksi
        isOpen={showModalEditProduksi}
        onClose={() => setShowModalEditProduksi(false)}
        onSuccess={fetchDetail}
        produksiData={produksi}
      />
    </div>
  );
}
