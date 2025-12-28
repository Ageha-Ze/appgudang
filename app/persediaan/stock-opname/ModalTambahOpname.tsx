// app/persediaan/stock-opname/ModalTambahOpname.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  stok: number;
}

interface Cabang {
  id: number;
  nama_cabang: string;
  kode_cabang: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModalTambahOpname({ isOpen, onClose, onSuccess }: Props) {
  const [produks, setProduks] = useState<Produk[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduk, setSelectedProduk] = useState<Produk | null>(null);
  const [branchStock, setBranchStock] = useState<number>(0);
  const [branchSatuan, setBranchSatuan] = useState<string>('Kg');
  const [loadingStock, setLoadingStock] = useState(false);
  
  const [formData, setFormData] = useState({
    produk_id: '',
    cabang_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    jumlah_fisik: 0,
    keterangan: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchProduks();
      fetchCabangs();
    }
  }, [isOpen]);

  // Get selected produk info
  useEffect(() => {
    if (formData.produk_id) {
      const produk = produks.find(p => p.id === parseInt(formData.produk_id));
      setSelectedProduk(produk || null);
    } else {
      setSelectedProduk(null);
    }
  }, [formData.produk_id, produks]);

  // Fetch branch-specific stock when both produk and cabang are selected
  useEffect(() => {
    const fetchBranchStock = async () => {
      if (formData.produk_id && formData.cabang_id) {
        setLoadingStock(true);
        try {
          const result = await fetchStockForProduct(
            parseInt(formData.produk_id),
            parseInt(formData.cabang_id)
          );
          setBranchStock(result.stock);
          setBranchSatuan(result.satuan);
        } catch (error) {
          console.error('Error fetching branch stock:', error);
          setBranchStock(0);
          setBranchSatuan('Kg');
        } finally {
          setLoadingStock(false);
        }
      } else {
        setBranchStock(0);
        setBranchSatuan('Kg');
      }
    };

    fetchBranchStock();
  }, [formData.produk_id, formData.cabang_id]);

  const fetchProduks = async () => {
    try {
      // Get all products first
      const res = await fetch('/api/master/produk');
      const json = await res.json();
      setProduks(json.data || []);
    } catch (error) {
      console.error('Error fetching produks:', error);
    }
  };

  // Fetch stock for specific product and branch
  const fetchStockForProduct = async (produkId: number, cabangId: number) => {
    try {
      const res = await fetch(`/api/persediaan/stock-barang?mode=aggregated&cabang_id=${cabangId}&limit=1000`);
      const json = await res.json();

      if (json.success && json.data) {
        // Find the specific product stock
        const productStock = json.data.find((item: any) => item.produk_id === produkId);
        return {
          stock: productStock?.total_stock || 0,
          satuan: productStock?.satuan || 'Kg'
        };
      }
      return { stock: 0, satuan: 'Kg' };
    } catch (error) {
      console.error('Error fetching stock for product:', error);
      return { stock: 0, satuan: 'Kg' };
    }
  };

  const fetchCabangs = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangs(json.data || []);
    } catch (error) {
      console.error('Error fetching cabangs:', error);
    }
  };

  const calculateSelisih = () => {
    if (!selectedProduk) return 0;
    return formData.jumlah_fisik - branchStock;
  };

  const selisih = calculateSelisih();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/persediaan/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Stock opname berhasil dicatat');
        setFormData({
          produk_id: '',
          cabang_id: '',
          tanggal: new Date().toISOString().split('T')[0],
          jumlah_fisik: 0,
          keterangan: '',
        });
        onSuccess();
        onClose();
      } else {
        alert('Gagal mencatat stock opname: ' + json.error);
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
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
              <p className="text-lg font-semibold text-gray-800">Menyimpan Stock Opname...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">TAMBAH STOCK OPNAME</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Tanggal */}
            <div>
              <label className="block mb-2 font-medium">Tanggal Opname</label>
              <input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            {/* Produk */}
            <div>
              <label className="block mb-2 font-medium">Produk</label>
              <select
                value={formData.produk_id}
                onChange={(e) => setFormData({ ...formData, produk_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">Pilih Produk</option>
                {produks.map((produk) => (
                  <option key={produk.id} value={produk.id}>
                    {produk.nama_produk} ({produk.kode_produk})
                  </option>
                ))}
              </select>
            </div>

            {/* Cabang/Gudang */}
            <div>
              <label className="block mb-2 font-medium">Gudang</label>
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value="">Pilih Gudang</option>
                {cabangs.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang} ({cabang.kode_cabang})
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Sistem (Read-only) */}
            {selectedProduk && formData.cabang_id && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label className="block mb-2 font-medium text-blue-900">
                  Stock di Sistem {loadingStock && '(Memuat...)'}
                </label>
                <input
                  type="text"
                  value={`${branchStock.toFixed(2)} ${branchSatuan}`}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-white font-bold text-lg"
                />
                <p className="text-xs text-blue-700 mt-1">
                  Stock untuk gudang yang dipilih
                </p>
              </div>
            )}

            {/* Jumlah Fisik */}
            <div>
              <label className="block mb-2 font-medium">Jumlah Fisik (Hasil Hitungan)</label>
              <input
                type="number"
                step="0.01"
                value={formData.jumlah_fisik || ''}
                onChange={(e) => setFormData({ ...formData, jumlah_fisik: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Masukkan hasil hitungan fisik"
                required
              />
            </div>

            {/* Selisih Display */}
            {selectedProduk && formData.jumlah_fisik > 0 && (
              <div className={`p-4 rounded-lg border-2 ${
                selisih === 0 
                  ? 'bg-green-50 border-green-300' 
                  : selisih > 0 
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-start gap-3">
                  {selisih !== 0 && (
                    <AlertTriangle className={`w-6 h-6 ${
                      selisih > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-lg mb-2">
                      {selisih === 0 && 'Stock Sesuai ✓'}
                      {selisih > 0 && 'Stock Lebih (+)'}
                      {selisih < 0 && 'Stock Kurang (-)'}
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Stock Sistem</p>
                        <p className="font-bold">{branchStock.toFixed(2)} {branchSatuan}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Stock Fisik</p>
                        <p className="font-bold">{formData.jumlah_fisik.toFixed(2)} {branchSatuan}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Selisih</p>
                        <p className={`font-bold text-lg ${
                          selisih === 0 ? 'text-green-600' : selisih > 0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {selisih > 0 ? '+' : ''}{selisih.toFixed(2)} {branchSatuan}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Keterangan */}
            <div>
              <label className="block mb-2 font-medium">Keterangan</label>
              <textarea
                value={formData.keterangan}
                onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
                placeholder="Catatan tambahan (opsional)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Contoh: Ditemukan 5kg rusak, 2kg kadaluarsa, dll
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 bg-gray-50 p-3 rounded text-sm text-gray-600">
            <p className="font-medium mb-1">ℹ️ Catatan:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Data ini akan berstatus "Pending" menunggu approval</li>
              <li>Stock sistem akan disesuaikan setelah di-approve</li>
              <li>Pastikan hitungan fisik sudah akurat sebelum submit</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              type="submit"
              disabled={loading || !formData.produk_id || !formData.cabang_id}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Menyimpan...' : 'Simpan Stock Opname'}
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
