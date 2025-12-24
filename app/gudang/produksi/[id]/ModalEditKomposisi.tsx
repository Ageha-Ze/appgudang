'use client';

import { useState, useEffect } from 'react';

interface Produk {
  produk_id: number;
  nama_produk: string;
  stok: number;
  satuan: string;
  terakhir_dibeli?: string;
  hpp: number;
}

interface DetailProduksi {
  id: number;
  item_id: number;
  jumlah: number;
  hpp: number;
  subtotal: number;
  item?: { nama_produk: string; satuan?: string };
}

interface ModalEditKomposisiProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produksiId: number;
  cabangId: number;
  editingDetail: DetailProduksi | null;
}

export default function ModalEditKomposisi({
  isOpen,
  onClose,
  onSuccess,
  produksiId,
  cabangId,
  editingDetail
}: ModalEditKomposisiProps) {
  const [form, setForm] = useState({ item_id: '', jumlah: '' });
  const [produks, setProduks] = useState<Produk[]>([]);
  const [selectedProduk, setSelectedProduk] = useState<Produk | null>(null);
  const [hpp, setHpp] = useState<number>(0);
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  // Fetch produk saat modal dibuka
  useEffect(() => {
    if (isOpen && cabangId) {
      fetchProduks();
    }
  }, [isOpen, cabangId]);

  // Populate form when editingDetail changes
  useEffect(() => {
    if (isOpen && editingDetail) {
      setForm({
        item_id: editingDetail.item_id.toString(),
        jumlah: editingDetail.jumlah.toString()
      });
      setHpp(editingDetail.hpp);
      setSubtotal(editingDetail.subtotal);

      // Find and set selected product
      if (produks.length > 0) {
        const selected = produks.find(p => p.produk_id === editingDetail.item_id);
        setSelectedProduk(selected || null);
      }
    }
  }, [isOpen, editingDetail, produks]);

  // Hitung subtotal dan validasi stock saat jumlah berubah
  useEffect(() => {
    if (form.jumlah && hpp && selectedProduk) {
      const qty = parseFloat(form.jumlah || '0');
      setSubtotal(hpp * qty);

      // Real-time stock validation
      if (qty > selectedProduk.stok) {
        setStockError(`⚠️ Stock tidak mencukupi! Tersedia: ${selectedProduk.stok} ${selectedProduk.satuan}`);
      } else if (qty <= 0) {
        setStockError('Jumlah harus lebih dari 0');
      } else {
        setStockError('');
      }
    } else {
      setSubtotal(0);
      setStockError('');
    }
  }, [form.jumlah, hpp, selectedProduk]);

  const fetchProduks = async () => {
    try {
      console.log('=== FETCHING PRODUCTS FROM STOCK ===');
      console.log('Cabang ID:', cabangId);

      // Use stock API for super fast fetching (denormalized data)
      const params = new URLSearchParams({
        cabang_id: cabangId.toString(),
        mode: 'overview',
        limit: '1000'
      });

      const res = await fetch(`/api/persediaan/stock-barang?${params}`);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json = await res.json();
      console.log('📦 Stock API response:', json);

      // Transform stock data to produk format
      const stockData = json.data || [];
      const produkData: Produk[] = stockData
        .filter((item: any) => {
          const stock = parseFloat(item.stock?.toString() || '0');
          return stock > 0; // Only show products with available stock
        })
        .map((item: any) => ({
          produk_id: item.produk_id,
          nama_produk: item.nama_produk || item.name || 'Unknown Product',
          stok: parseFloat(item.stock?.toString() || '0'),
          satuan: item.satuan || item.unit || 'unit',
          hpp: parseFloat(item.hpp?.toString() || '0')
        }));

      console.log('🎯 Filtered products with stock > 0:', produkData.length);
      setProduks(produkData);

      // Set selected product after products are loaded
      if (editingDetail && produkData.length > 0) {
        const selected = produkData.find(p => p.produk_id === editingDetail.item_id);
        setSelectedProduk(selected || null);
      }
    } catch (error) {
      console.error('❌ Error fetching produk from stock:', error);
      alert('Gagal memuat data produk dari stock. Cek console untuk detail error.');
    }
  };

  const handleItemChange = (itemId: string) => {
    setForm({ ...form, item_id: itemId, jumlah: '' });

    if (itemId) {
      const selected = produks.find(p => p.produk_id === Number(itemId));
      setSelectedProduk(selected || null);

      // Langsung set HPP dari data produk
      setHpp(selected?.hpp || 0);
    } else {
      setSelectedProduk(null);
      setHpp(0);
      setSubtotal(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduk) {
      alert('Pilih item terlebih dahulu');
      return;
    }

    if (!editingDetail) {
      alert('Data edit tidak ditemukan');
      return;
    }

    const qty = parseFloat(form.jumlah);

    if (qty <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }

    // Validasi stock
    if (qty > selectedProduk.stok) {
      alert(`Stock tidak mencukupi! Tersedia: ${selectedProduk.stok} ${selectedProduk.satuan}`);
      return;
    }

    if (hpp <= 0) {
      alert('HPP tidak valid. Pastikan produk memiliki HPP.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/gudang/produksi/${produksiId}/details/${editingDetail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: form.item_id,
          jumlah: qty,
          hpp: hpp,
          subtotal: subtotal
        }),
      });

      const responseData = await res.json();

      if (res.ok) {
        alert('Item berhasil diupdate');
        setForm({ item_id: '', jumlah: '' });
        setSelectedProduk(null);
        setHpp(0);
        setSubtotal(0);
        onSuccess();
        onClose();
      } else {
        alert('Error: ' + (responseData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Edit Komposisi Item</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Item */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Item Bahan Baku <span className="text-red-500">*</span>
            </label>
            <select
              value={form.item_id}
              onChange={(e) => handleItemChange(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-violet-500 max-h-40 overflow-y-auto"
              disabled={loading}
            >
              <option value="">Pilih Item</option>
              {produks.map((p) => (
                <option key={p.produk_id} value={p.produk_id}>
                  {p.nama_produk} (Stock: {p.stok} {p.satuan})
                </option>
              ))}
            </select>
            {produks.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Belum ada bahan baku yang dibeli untuk cabang ini
              </p>
            )}
          </div>

          {/* Info Produk Terpilih */}
          {selectedProduk && (
            <>
              {/* Jumlah */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jumlah <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.jumlah}
                  onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  required
                  max={selectedProduk.stok}
                  min="0.01"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-violet-500"
                  placeholder="0"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: {selectedProduk.stok} {selectedProduk.satuan}
                </p>
                {stockError && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    {stockError}
                  </p>
                )}
              </div>

              {/* Stock Tersedia */}
              <div>
                <label className="block text-sm font-medium mb-1">Stock Tersedia</label>
                <input
                  type="text"
                  value={`${selectedProduk.stok} ${selectedProduk.satuan}`}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                />
              </div>

              {/* HPP */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  HPP (Harga Pokok)
                </label>
                <input
                  type="text"
                  value={`Rp. ${hpp.toLocaleString('id-ID')}`}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                />
              </div>

              {/* Subtotal */}
              <div>
                <label className="block text-sm font-medium mb-1">Subtotal</label>
                <input
                  type="text"
                  value={`Rp. ${subtotal.toLocaleString('id-ID')}`}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-blue-50 text-blue-900 font-semibold"
                />
              </div>

              {/* Terakhir Dibeli */}
              {selectedProduk.terakhir_dibeli && (
                <div>
                  <label className="block text-sm font-medium mb-1">Terakhir Dibeli</label>
                  <input
                    type="text"
                    value={new Date(selectedProduk.terakhir_dibeli).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                    disabled
                    className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-700"
                  />
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || !selectedProduk || !form.jumlah || !!stockError}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Menyimpan...' : 'Update'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 transition-all"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
