'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  harga: number;
}

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPembelian?: any) => void;
  detail: DetailPembelian;
  pembelianId: number;
}

export default function ModalEditBarangPembelian({
  isOpen,
  onClose,
  onSuccess,
  detail,
  pembelianId,
}: Props) {
  const [produks, setProduks] = useState<Produk[]>([]);
  const [formData, setFormData] = useState({
    produk_id: detail.produk_id,
    nama_produk: detail.produk?.nama_produk || '',
    harga: detail.harga,
    jumlah: detail.jumlah,
    jumlah_box: detail.jumlah_box,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProduks();
      setFormData({
        produk_id: detail.produk_id,
        nama_produk: detail.produk?.nama_produk || '',
        harga: detail.harga,
        jumlah: detail.jumlah,
        jumlah_box: detail.jumlah_box,
      });
    }
  }, [isOpen, detail]);

  const fetchProduks = async () => {
    try {
      const res = await fetch('/api/master/produk');
      const json = await res.json();
      setProduks(json.data || []);
    } catch (error) {
      console.error('Error fetching produks:', error);
    }
  };

  const handleProdukChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProduk = produks.find(p => p.id === parseInt(e.target.value));
    if (selectedProduk) {
      setFormData({
        ...formData,
        produk_id: selectedProduk.id,
        nama_produk: selectedProduk.nama_produk,
        harga: selectedProduk.harga,
      });
    }
  };

  const calculateTotal = () => {
    return formData.harga * formData.jumlah;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(
        `/api/transaksi/pembelian/${pembelianId}/items/${detail.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            produk_id: formData.produk_id,
            jumlah: parseFloat(formData.jumlah.toString()),
            jumlah_box: parseInt(formData.jumlah_box.toString()),
            harga: parseFloat(formData.harga.toString()),
            subtotal: calculateTotal(),
          }),
        }
      );

      const json = await res.json();

      if (res.ok) {
        alert('Data berhasil diupdate');
        onSuccess(json?.pembelian);
        onClose();
      } else {
        alert('Gagal update: ' + json.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Memperbarui Barang Pembelian...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">EDIT PRODUK</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Nama Produk */}
            <div>
              <label className="block mb-2 font-medium">Nama Produk</label>
              <select
                value={formData.produk_id}
                onChange={handleProdukChange}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">Pilih Produk</option>
                {produks.map((produk) => (
                  <option key={produk.id} value={produk.id}>
                    {produk.nama_produk}
                  </option>
                ))}
              </select>
            </div>

            {/* Harga Beli */}
            <div>
              <label className="block mb-2 font-medium">Harga Beli</label>
              <input
                type="number"
                value={formData.harga}
                onChange={(e) =>
                  setFormData({ ...formData, harga: parseFloat(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            {/* Jumlah dan Total */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium">Jumlah</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.jumlah}
                  onChange={(e) =>
                    setFormData({ ...formData, jumlah: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">Total Harga</label>
                <input
                  type="text"
                  value={calculateTotal().toLocaleString('id-ID')}
                  className="w-full px-3 py-2 border rounded bg-gray-100"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
      )}
    </SingleOverlay>
  );
}
