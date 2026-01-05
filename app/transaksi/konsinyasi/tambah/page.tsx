'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';
import SingleOverlay from '../../../../components/SingleOverlay';

interface Toko {
  id: number;
  kode_toko: string;
  nama_toko: string;
  status: string;
}

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface Pegawai {
  id: number;
  nama: string;
}

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  stok: number;
  satuan: string;
  hpp: number;
}

interface DetailItem {
  produk_id: number;
  nama_produk: string;
  jumlah_titip: number;
  harga_konsinyasi: number;
  harga_jual_toko: number;
  subtotal: number;
}

export default function TambahKonsinyasiPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    tanggal_titip: new Date().toISOString().split('T')[0],
    toko_id: '',
    cabang_id: '',
    pegawai_id: '',
    keterangan: '',
  });

  const [tokoList, setTokoList] = useState<Toko[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduk, setLoadingProduk] = useState(true);
  const [showTokoModal, setShowTokoModal] = useState(false);

  const [quickTokoForm, setQuickTokoForm] = useState({
    kode_toko: '',
    nama_toko: '',
    pemilik: '',
    no_telp: '',
    alamat: '',
  });

  const [currentItem, setCurrentItem] = useState({
    produk_id: '',
    jumlah_titip: '',
    harga_konsinyasi: '',
    harga_jual_toko: '',
  });

  useEffect(() => {
    fetchToko();
    fetchCabang();
    fetchProduk();
  }, []);

  // Refetch products when branch changes
  useEffect(() => {
    if (formData.cabang_id) {
      fetchProduk();
    }
  }, [formData.cabang_id]);

  useEffect(() => {
    if (formData.cabang_id) {
      fetchPegawaiByCabang(formData.cabang_id);
    } else {
      setPegawaiList([]);
    }
    // Reset pegawai selection when cabang changes
    setFormData(prev => ({ ...prev, pegawai_id: '' }));
  }, [formData.cabang_id]);

  const fetchToko = async () => {
    try {
      const res = await fetch('/api/transaksi/konsinyasi/toko?limit=100');
      const json = await res.json();
      console.log('Toko data:', json);
      setTokoList(json.data?.filter((t: Toko) => t.status === 'Aktif') || []);
    } catch (error) {
      console.error('Error fetching toko:', error);
      alert('Gagal memuat data toko');
    }
  };

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      console.log('Cabang data:', json);
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
      alert('Gagal memuat data cabang');
    }
  };

  const fetchPegawaiByCabang = async (cabangId: string) => {
    try {
      const res = await fetch(`/api/master/pegawai?cabang_id=${cabangId}`);
      const json = await res.json();
      console.log('Pegawai data by cabang:', json);
      setPegawaiList(json.data || []);
    } catch (error) {
      console.error('Error fetching pegawai by cabang:', error);
      alert('Gagal memuat data pegawai');
    }
  };

  const fetchProduk = async () => {
    try {
      setLoadingProduk(true);
      console.log('Fetching produk...', formData.cabang_id ? `for branch ${formData.cabang_id}` : 'all products');

      const url = formData.cabang_id
        ? `/api/master/produk?limit=1000&cabang_id=${formData.cabang_id}`
        : '/api/master/produk?limit=1000';

      const res = await fetch(url);
      const json = await res.json();

      console.log('Produk response:', json);
      console.log('Produk data length:', json.data?.length);

      if (json.data && Array.isArray(json.data)) {
        setProdukList(json.data);
        console.log('Produk berhasil dimuat:', json.data.length, 'items');
      } else {
        console.error('Format data produk salah:', json);
        alert('Format data produk tidak valid');
      }
    } catch (error) {
      console.error('Error fetching produk:', error);
      alert('Gagal memuat data produk');
    } finally {
      setLoadingProduk(false);
    }
  };

  const handleAddItem = () => {
    if (!currentItem.produk_id || !currentItem.jumlah_titip || !currentItem.harga_konsinyasi || !currentItem.harga_jual_toko) {
      alert('Lengkapi semua field produk');
      return;
    }

    const produk = produkList.find(p => p.id === parseInt(currentItem.produk_id));
    if (!produk) {
      alert('Produk tidak ditemukan');
      return;
    }

    const jumlah = parseFloat(currentItem.jumlah_titip);
    const hargaKonsinyasi = parseFloat(currentItem.harga_konsinyasi);
    const hargaJual = parseFloat(currentItem.harga_jual_toko);

    if (jumlah > produk.stok) {
      alert(`Stok tidak mencukupi! Stok tersedia: ${produk.stok} ${produk.satuan || 'pcs'}`);
      return;
    }

    if (hargaJual <= hargaKonsinyasi) {
      alert('Harga jual toko harus lebih besar dari harga konsinyasi!');
      return;
    }

    if (detailItems.some(item => item.produk_id === parseInt(currentItem.produk_id))) {
      alert('Produk sudah ditambahkan!');
      return;
    }

    const newItem: DetailItem = {
      produk_id: parseInt(currentItem.produk_id),
      nama_produk: produk.nama_produk,
      jumlah_titip: jumlah,
      harga_konsinyasi: hargaKonsinyasi,
      harga_jual_toko: hargaJual,
      subtotal: jumlah * hargaKonsinyasi,
    };

    setDetailItems([...detailItems, newItem]);
    
    setCurrentItem({
      produk_id: '',
      jumlah_titip: '',
      harga_konsinyasi: '',
      harga_jual_toko: '',
    });
  };

  const handleRemoveItem = (index: number) => {
    setDetailItems(detailItems.filter((_, i) => i !== index));
  };

  const handleProdukChange = (produkId: string) => {
    const produk = produkList.find(p => p.id === parseInt(produkId));
    setCurrentItem({
      ...currentItem,
      produk_id: produkId,
      harga_konsinyasi: produk?.hpp?.toString() || '',
    });
  };

  const calculateTotal = () => {
    return detailItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleSubmit = async () => {
    if (!formData.tanggal_titip || !formData.toko_id || !formData.cabang_id) {
      alert('Tanggal, Toko, dan Cabang wajib diisi');
      return;
    }

    if (detailItems.length === 0) {
      alert('Tambahkan minimal 1 produk');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        toko_id: parseInt(formData.toko_id),
        cabang_id: parseInt(formData.cabang_id),
        pegawai_id: formData.pegawai_id ? parseInt(formData.pegawai_id) : null,
        detail: detailItems,
      };

      console.log('Submitting payload:', payload);

      const res = await fetch('/api/transaksi/konsinyasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Konsinyasi berhasil dibuat');
        router.push(`/transaksi/konsinyasi/${json.data.id}`);
      } else {
        alert(json.error || 'Gagal membuat konsinyasi');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddToko = async () => {
    if (!quickTokoForm.kode_toko || !quickTokoForm.nama_toko) {
      alert('Kode dan Nama Toko wajib diisi');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/transaksi/konsinyasi/toko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quickTokoForm,
          status: 'Aktif',
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Toko berhasil ditambahkan');
        setShowTokoModal(false);
        fetchToko();
        setFormData({ ...formData, toko_id: json.data.id.toString() });
        setQuickTokoForm({
          kode_toko: '',
          nama_toko: '',
          pemilik: '',
          no_telp: '',
          alamat: '',
        });
      } else {
        alert(json.error || 'Gagal menambahkan toko');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
      setLoading(false);
    }

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan Konsinyasi...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="bg-indigo-500 p-3 rounded-lg">
          <Package className="text-white" size={24} />
        </div>
        <div>
          <p className="text-sm text-indigo-600">Transaksi Konsinyasi</p>
          <h1 className="text-2xl font-bold text-indigo-700">Tambah Konsinyasi Baru</h1>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Informasi Konsinyasi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Tanggal Titip <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tanggal_titip}
                onChange={(e) => setFormData({ ...formData, tanggal_titip: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Toko <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={formData.toko_id}
                  onChange={(e) => setFormData({ ...formData, toko_id: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-full truncate"
                >
                  <option value="">-- Pilih Toko --</option>
                  {tokoList.map((toko) => (
                    <option key={toko.id} value={toko.id}>
                      {toko.kode_toko} - {toko.nama_toko}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowTokoModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap self-start sm:self-auto flex items-center gap-2"
                >
                  <Plus size={20} />
                  Tambah Toko
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Pegawai Pengantar</label>
              <select
                value={formData.pegawai_id}
                onChange={(e) => setFormData({ ...formData, pegawai_id: e.target.value })}
                disabled={!formData.cabang_id}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {formData.cabang_id ? '-- Pilih Pegawai --' : '-- Pilih Cabang terlebih dahulu --'}
                </option>
                {pegawaiList.map((pegawai) => (
                  <option key={pegawai.id} value={pegawai.id}>
                    {pegawai.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

         
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Tambah Barang</h2>
          
          {loadingProduk && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-700">Memuat data produk...</span>
            </div>
          )}
          
          {!loadingProduk && produkList.length === 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="text-yellow-600" size={20} />
              <span className="text-yellow-700">
                Tidak ada produk tersedia. Pastikan sudah ada data produk di master.
              </span>
            </div>
          )}
          
          {!loadingProduk && produkList.length > 0 && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Package className="text-green-600" size={20} />
              <span className="text-green-700">
                {produkList.length} produk tersedia
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-gray-700 font-medium mb-2">Produk</label>
              <select
                value={currentItem.produk_id}
                onChange={(e) => handleProdukChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loadingProduk || produkList.length === 0}
              >
                <option value="">
                  {loadingProduk ? 'Memuat...' : produkList.length === 0 ? 'Tidak ada produk' : '-- Pilih Produk --'}
                </option>
                {produkList.map((produk) => (
                  <option key={produk.id} value={produk.id}>
                    {produk.nama_produk} (Stok: {produk.stok} {produk.satuan || 'pcs'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Jumlah</label>
              <input
                type="number"
                step="0.01"
                value={currentItem.jumlah_titip}
                onChange={(e) => setCurrentItem({ ...currentItem, jumlah_titip: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Harga Konsinyasi</label>
              <input
                type="number"
                step="0.01"
                value={currentItem.harga_konsinyasi}
                onChange={(e) => setCurrentItem({ ...currentItem, harga_konsinyasi: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Harga Jual Toko</label>
              <input
                type="number"
                step="0.01"
                value={currentItem.harga_jual_toko}
                onChange={(e) => setCurrentItem({ ...currentItem, harga_jual_toko: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
              />
            </div>
          </div>

          <button
            onClick={handleAddItem}
            disabled={loadingProduk || produkList.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            Tambah Barang
          </button>
        </div>

        {detailItems.length > 0 && (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Detail Barang</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-indigo-100">
                    <tr>
                      <th className="px-4 py-3 text-left border">Produk</th>
                      <th className="px-4 py-3 text-right border">Jumlah</th>
                      <th className="px-4 py-3 text-right border">Harga Konsinyasi</th>
                      <th className="px-4 py-3 text-right border">Harga Jual Toko</th>
                      <th className="px-4 py-3 text-right border">Subtotal</th>
                      <th className="px-4 py-3 text-center border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-indigo-50">
                        <td className="px-4 py-3 border">{item.nama_produk}</td>
                        <td className="px-4 py-3 text-right border">{item.jumlah_titip}</td>
                        <td className="px-4 py-3 text-right border">
                          Rp {item.harga_konsinyasi.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right border">
                          Rp {item.harga_jual_toko.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right border">
                          Rp {item.subtotal.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center border">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-right border">Total:</td>
                      <td className="px-4 py-3 text-right border">
                        Rp {calculateTotal().toLocaleString('id-ID')}
                      </td>
                      <td className="border"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              <div className="bg-white rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Detail Barang</h2>
              </div>
              {detailItems.map((item, index) => (
                <div key={index} className="bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
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
                        <p className="text-xs text-emerald-100 mb-1">🗂️ Item #{index + 1}</p>
                        <p className="font-mono text-base font-bold">{item.nama_produk}</p>
                      </div>
                      <div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-emerald-900">
                          Jml: {item.jumlah_titip}
                        </span>
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💰</span>
                        <div>
                          <p className="text-xs text-emerald-100">Harga Konsinyasi</p>
                          <p className="text-sm font-semibold">Rp. {item.harga_konsinyasi.toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-base">🏪</span>
                        <div>
                          <p className="text-xs text-emerald-100">Harga Jual Toko</p>
                          <p className="text-sm font-semibold">Rp. {item.harga_jual_toko.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-4"></div>

                    {/* Footer with subtotal and action */}
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-sm text-emerald-100">Subtotal</span>
                        <p className="text-xl font-bold">Rp. {item.subtotal.toLocaleString('id-ID')}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Total Summary for Mobile */}
              <div className="bg-white rounded-xl shadow-lg p-4 lg:hidden">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-800">Total Seluruhnya:</span>
                  <span className="text-xl font-bold text-emerald-600">
                    Rp {calculateTotal().toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading || detailItems.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            <Save size={20} />
            {loading ? 'Menyimpan...' : 'Simpan Konsinyasi'}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition whitespace-nowrap"
          >
            <X size={20} />
            Batal
          </button>
        </div>
      </div>

      {showTokoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Tambah Toko Cepat</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Kode Toko <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickTokoForm.kode_toko}
                  onChange={(e) => setQuickTokoForm({ ...quickTokoForm, kode_toko: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="TK001"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Nama Toko <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickTokoForm.nama_toko}
                  onChange={(e) => setQuickTokoForm({ ...quickTokoForm, nama_toko: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Toko Sumber Rejeki"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Pemilik</label>
                <input
                  type="text"
                  value={quickTokoForm.pemilik}
                  onChange={(e) => setQuickTokoForm({ ...quickTokoForm, pemilik: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Pak Budi"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">No Telp</label>
                <input
                  type="text"
                  value={quickTokoForm.no_telp}
                  onChange={(e) => setQuickTokoForm({ ...quickTokoForm, no_telp: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="08123456789"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Alamat</label>
                <textarea
                  value={quickTokoForm.alamat}
                  onChange={(e) => setQuickTokoForm({ ...quickTokoForm, alamat: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Jl. Raya No. 123"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleQuickAddToko}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  onClick={() => setShowTokoModal(false)}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </SingleOverlay>
  );
}
