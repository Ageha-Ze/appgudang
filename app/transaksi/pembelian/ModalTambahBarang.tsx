'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Produk {
  id: number;
  nama_produk: string;
  is_jerigen: boolean;
  satuan: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPembelian?: any) => void;
  pembelianId: number;
}

export default function ModalTambahBarang({ isOpen, onClose, onSuccess, pembelianId }: Props) {
  const [loading, setLoading] = useState(false);
  const [produks, setProduks] = useState<Produk[]>([]);
  const [selectedProduk, setSelectedProduk] = useState<Produk | null>(null);

  const [formData, setFormData] = useState({
    produk_id: '',
    harga: '',
    jumlah: '',
    jumlah_box: '',
    total_harga: 0,
  });

  // Load produk list
  useEffect(() => {
    if (isOpen) {
      fetchProduks();
    }
  }, [isOpen]);

  // Update selected produk
  useEffect(() => {
    if (formData.produk_id) {
      const produk = produks.find(p => p.id === parseInt(formData.produk_id));
      setSelectedProduk(produk || null);
      // Reset jumlah_box jika produk berubah
      if (produk && !produk.is_jerigen) {
        setFormData(prev => ({ ...prev, jumlah_box: '0' }));
      }
    } else {
      setSelectedProduk(null);
    }
  }, [formData.produk_id, produks]);

  // Auto-calculate total harga
  useEffect(() => {
    const total = parseFloat(formData.harga || '0') * parseFloat(formData.jumlah || '0');
    setFormData(prev => ({ ...prev, total_harga: total }));
  }, [formData.harga, formData.jumlah]);

  const fetchProduks = async () => {
    try {
      const res = await fetch('/api/master/produk');
      const json = await res.json();
      setProduks(json.data || []);
    } catch (error) {
      console.error('Error fetching produks:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produk_id: parseInt(formData.produk_id),
          harga: parseFloat(formData.harga),
          jumlah: parseFloat(formData.jumlah),
          jumlah_box: selectedProduk?.is_jerigen ? parseInt(formData.jumlah_box) : 0,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        // Show loading spinner while processing success
        setLoading(true);
        setTimeout(() => {
          alert('Data berhasil disimpan');
          onSuccess(json?.pembelian);
          handleClose();
          setLoading(false);
        }, 1000);
      } else {
        // Handle duplicate product error specifically
        if (json.errorCode === 'DUPLICATE_PRODUCT') {
          alert(`❌ ${json.error}\n\nSilakan hapus item yang sudah ada terlebih dahulu jika ingin menambahkan kembali.`);
        } else {
          alert(json.error || 'Gagal menyimpan data');
        }
      }
    } catch (error) {
      alert('Terjadi kesalahan');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      produk_id: '',
      harga: '',
      jumlah: '',
      jumlah_box: '',
      total_harga: 0,
    });
    setSelectedProduk(null);
    onClose();
  };

  // ✅ HANYA SATU CHECK - HAPUS YANG DUPLIKAT
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-yellow-100 px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">TAMBAH BARANG</h2>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nama Produk */}
          <div className="space-y-2">
            <label className="font-medium">Nama Produk</label>
            <select
              value={formData.produk_id}
              onChange={(e) => setFormData({ ...formData, produk_id: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value="">Pilih Produk</option>
              {produks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_produk}
                </option>
              ))}
            </select>
          </div>

          {/* Harga Beli */}
          <div className="space-y-2">
            <label className="font-medium">Harga Beli</label>
            <input
              type="number"
              value={formData.harga}
              onChange={(e) => setFormData({ ...formData, harga: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="0"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Jumlah */}
          <div className="space-y-2">
            <label className="font-medium">Jumlah</label>
            <input
              type="number"
              value={formData.jumlah}
              onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="0"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Jumlah Jerigen/Box - Conditional */}
          {selectedProduk?.is_jerigen && (
            <div className="space-y-2">
              <label className="font-medium">Jumlah Jerigen</label>
              <input
                type="number"
                value={formData.jumlah_box}
                onChange={(e) => setFormData({ ...formData, jumlah_box: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
                required
                min="0"
              />
            </div>
          )}

          {/* Total Harga (Read-only) */}
          <div className="space-y-2">
            <label className="font-medium">Total Harga</label>
            <input
              type="text"
              value={`Rp ${formData.total_harga.toLocaleString('id-ID')}`}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-8 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
