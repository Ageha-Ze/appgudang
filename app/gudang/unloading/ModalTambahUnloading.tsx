'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface ModalTambahUnloadingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stok: number;
  is_jerigen: boolean;
}

interface DetailItem {
  produk_jerigen_id: number;
  nama_jerigen: string;
  produk_kiloan_id: number;
  nama_kiloan: string;
  jumlah: number;
  satuan: string;
  stok_jerigen: number;
  keterangan: string;
}

export default function ModalTambahUnloading({
  isOpen,
  onClose,
  onSuccess,
}: ModalTambahUnloadingProps) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    cabang_id: '',
    keterangan: '',
  });

  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [produkJerigenList, setProdukJerigenList] = useState<Produk[]>([]);
  const [produkKiloanList, setProdukKiloanList] = useState<Produk[]>([]);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentItem, setCurrentItem] = useState({
    produk_jerigen_id: '',
    produk_kiloan_id: '',
    jumlah: '',
    keterangan: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCabang();
      fetchProduk();
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        cabang_id: '',
        keterangan: '',
      });
      setDetailItems([]);
      setCurrentItem({ 
        produk_jerigen_id: '', 
        produk_kiloan_id: '', 
        jumlah: '', 
        keterangan: '' 
      });
    }
  }, [isOpen]);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const fetchProduk = async () => {
    try {
      const res = await fetch('/api/master/produk?limit=1000');
      const json = await res.json();
      const allProducts = json.data || [];
      
      setProdukJerigenList(allProducts.filter((p: Produk) => 
        p.is_jerigen === true && p.stok > 0
      ));
      
      setProdukKiloanList(allProducts.filter((p: Produk) =>
        p.is_jerigen === false
      ));
    } catch (error) {
      console.error('Error fetching produk:', error);
    }
  };

  const handleAddItem = () => {
    if (!currentItem.produk_jerigen_id || !currentItem.produk_kiloan_id || !currentItem.jumlah) {
      alert('Produk jerigen, produk kiloan, dan jumlah wajib diisi');
      return;
    }

    const produkJerigen = produkJerigenList.find(p => p.id === parseInt(currentItem.produk_jerigen_id));
    const produkKiloan = produkKiloanList.find(p => p.id === parseInt(currentItem.produk_kiloan_id));
    
    if (!produkJerigen || !produkKiloan) {
      alert('Produk tidak ditemukan');
      return;
    }

    const jumlah = parseFloat(currentItem.jumlah);

    if (jumlah <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }

    if (jumlah > produkJerigen.stok) {
      alert(`Stock ${produkJerigen.nama_produk} tidak mencukupi! Stock tersedia: ${produkJerigen.stok} ${produkJerigen.satuan}`);
      return;
    }

    if (detailItems.some(item => 
      item.produk_jerigen_id === parseInt(currentItem.produk_jerigen_id) &&
      item.produk_kiloan_id === parseInt(currentItem.produk_kiloan_id)
    )) {
      alert('Kombinasi produk ini sudah ditambahkan!');
      return;
    }

    const newItem: DetailItem = {
      produk_jerigen_id: parseInt(currentItem.produk_jerigen_id),
      nama_jerigen: produkJerigen.nama_produk,
      produk_kiloan_id: parseInt(currentItem.produk_kiloan_id),
      nama_kiloan: produkKiloan.nama_produk,
      jumlah: jumlah,
      satuan: produkJerigen.satuan,
      stok_jerigen: produkJerigen.stok,
      keterangan: currentItem.keterangan,
    };

    setDetailItems([...detailItems, newItem]);
    setCurrentItem({ 
      produk_jerigen_id: '', 
      produk_kiloan_id: '', 
      jumlah: '', 
      keterangan: '' 
    });
  };

  const handleRemoveItem = (index: number) => {
    setDetailItems(detailItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tanggal || !formData.cabang_id) {
      alert('Tanggal dan Cabang wajib diisi');
      return;
    }

    if (detailItems.length === 0) {
      alert('Tambahkan minimal 1 item unloading');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        tanggal: formData.tanggal,
        cabang_id: parseInt(formData.cabang_id),
        keterangan: formData.keterangan,
        items: detailItems,
      };

      const res = await fetch('/api/gudang/unloading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert('✅ Unloading berhasil! Stock jerigen berkurang, stock kiloan bertambah.');
        onSuccess();
        onClose();
      } else {
        alert(`❌ ${json.error || 'Gagal menyimpan unloading'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalQty = () => {
    return detailItems.reduce((sum, item) => sum + item.jumlah, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Tambah Unloading Barang</h2>
            <p className="text-xs sm:text-sm text-gray-500">Tuang madu dari jerigen ke kiloan/eceran</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800 p-1">
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Form Utama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tanggal Unloading <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tambah Unloading */}
          <div className="border-t pt-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                Tambah Item Unloading
              </span>
            </h3>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Produk Jerigen (Sumber) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentItem.produk_jerigen_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, produk_jerigen_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Produk Jerigen --</option>
                    {produkJerigenList.map((produk) => (
                      <option key={produk.id} value={produk.id}>
                        {produk.nama_produk} (Stock: {produk.stok} {produk.satuan})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">⬇️ Stock akan berkurang</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Produk Kiloan/Eceran (Tujuan) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentItem.produk_kiloan_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, produk_kiloan_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Produk Kiloan --</option>
                    {produkKiloanList.map((produk) => (
                      <option key={produk.id} value={produk.id}>
                        {produk.nama_produk} (Stock: {produk.stok} {produk.satuan})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">⬆️ Stock akan bertambah</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Jumlah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentItem.jumlah}
                    onChange={(e) => setCurrentItem({ ...currentItem, jumlah: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Keterangan</label>
                  <input
                    type="text"
                    value={currentItem.keterangan}
                    onChange={(e) => setCurrentItem({ ...currentItem, keterangan: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Catatan (opsional)"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
              >
                <Plus size={18} />
                Tambah ke List
              </button>
            </div>
          </div>

          {/* List Items */}
          {detailItems.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-bold text-gray-800 mb-3 text-sm sm:text-base">
                List Items ({detailItems.length} item)
              </h3>
              
              {/* Mobile View - Cards */}
              <div className="block sm:hidden space-y-3">
                {detailItems.map((item, index) => (
                  <div key={index} className="bg-white border border-indigo-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{item.nama_jerigen}</div>
                        <div className="text-xs text-gray-500">Stock: {item.stok_jerigen}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="text-center text-indigo-600 font-bold text-sm my-2">↓</div>
                    <div className="text-sm font-medium text-gray-800 mb-2">{item.nama_kiloan}</div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-600">Jumlah:</span>
                      <span className="text-sm font-semibold text-green-600">
                        {item.jumlah.toFixed(2)} {item.satuan}
                      </span>
                    </div>
                    {item.keterangan && (
                      <div className="mt-2 text-xs text-gray-600">{item.keterangan}</div>
                    )}
                  </div>
                ))}
                <div className="bg-indigo-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">Total:</span>
                    <span className="font-bold text-green-600">{calculateTotalQty().toFixed(2)} kg</span>
                  </div>
                </div>
              </div>

              {/* Desktop View - Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-indigo-100">
                    <tr>
                      <th className="px-3 py-2 text-left border">Produk Jerigen</th>
                      <th className="px-3 py-2 text-center border">→</th>
                      <th className="px-3 py-2 text-left border">Produk Kiloan</th>
                      <th className="px-3 py-2 text-right border">Jumlah</th>
                      <th className="px-3 py-2 text-left border">Keterangan</th>
                      <th className="px-3 py-2 text-center border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 border">
                          <div>
                            <div className="font-medium">{item.nama_jerigen}</div>
                            <div className="text-xs text-gray-500">Stock: {item.stok_jerigen}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center border">
                          <span className="text-indigo-600 font-bold">→</span>
                        </td>
                        <td className="px-3 py-2 border font-medium">{item.nama_kiloan}</td>
                        <td className="px-3 py-2 text-right border">
                          <span className="font-semibold text-green-600">
                            {item.jumlah.toFixed(2)} {item.satuan}
                          </span>
                        </td>
                        <td className="px-3 py-2 border text-gray-600">{item.keterangan || '-'}</td>
                        <td className="px-3 py-2 text-center border">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right border">Total:</td>
                      <td className="px-3 py-2 text-right border text-green-600">
                        {calculateTotalQty().toFixed(2)} kg
                      </td>
                      <td colSpan={2} className="border"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Keterangan Umum */}
          <div>
            <label className="block text-sm font-medium mb-1">Keterangan Umum</label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || detailItems.length === 0}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Unloading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
