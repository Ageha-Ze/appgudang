'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';
import { SuplierData } from '@/types/suplier';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pembelianData: {
    id: number;
    tanggal: string;
    nota_supplier: string;
    jenis_pembayaran: string;
    suplier?: {
      nama: string;
    };
  };
}

// ✅ Extend interface untuk include cabang
interface SuplierWithCabang extends SuplierData {
  cabang?: {
    id: number;
    nama_cabang: string;
    kode_cabang: string;
  };
}

export default function ModalEditDataPembelian({
  isOpen,
  onClose,
  onSuccess,
  pembelianData,
}: Props) {
  const [formData, setFormData] = useState({
    tanggal: '',
    nota_supplier: '',
    jenis_pembayaran: '',
    suplier_id: '',
    cabang_id: '', // ✅ Tambahkan cabang_id
  });
  const [supliers, setSupliers] = useState<SuplierWithCabang[]>([]);
  const [selectedSuplier, setSelectedSuplier] = useState<SuplierWithCabang | null>(null); // ✅ Track selected supplier
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pembelianData) {
      setFormData({
        tanggal: pembelianData.tanggal.split('T')[0],
        nota_supplier: pembelianData.nota_supplier,
        jenis_pembayaran: pembelianData.jenis_pembayaran,
        suplier_id: '',
        cabang_id: '',
      });
    }

    // Fetch supliers dengan relasi cabang
    const fetchSupliers = async () => {
      try {
        const res = await fetch('/api/master/supplier');
        const responseData = await res.json();
        if (res.ok) {
          setSupliers(responseData.data);
        }
      } catch (error) {
        console.error('Error fetching supliers:', error);
      }
    };

    if (isOpen) {
      fetchSupliers();
    }
  }, [isOpen, pembelianData]);

  // ✅ Handle Supplier Change
  const handleSuplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const suplierId = e.target.value;
    const suplier = supliers.find(s => s.id.toString() === suplierId);
    
    setSelectedSuplier(suplier || null);
    setFormData({
      ...formData,
      suplier_id: suplierId,
      cabang_id: suplier?.cabang?.id.toString() || '', // ✅ Auto-set cabang dari supplier
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Prevent double-submit
    if (loading) {
      console.log('⚠️ Submit already in progress, ignoring...');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/transaksi/pembelian/${pembelianData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Data berhasil diupdate');
        onSuccess();
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
              <p className="text-lg font-semibold text-gray-800">Memperbarui Data Pembelian...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">EDIT PEMBELIAN BARANG</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Tgl Pembelian */}
              <div>
                <label className="block mb-2 font-medium">Tgl Pembelian</label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) =>
                    setFormData({ ...formData, tanggal: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              {/* Nota Supplier */}
              <div>
                <label className="block mb-2 font-medium">Nota Supplier</label>
                <input
                  type="text"
                  value={formData.nota_supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, nota_supplier: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              {/* ✅ Supplier Dropdown */}
              <div>
                <label className="block mb-2 font-medium">Supplier</label>
                <select
                  value={formData.suplier_id}
                  onChange={handleSuplierChange}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Pilih Supplier</option>
                  {supliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Show Cabang jika Supplier dipilih */}
              {selectedSuplier?.cabang && (
                <div>
                  <label className="block mb-2 font-medium">Cabang</label>
                  <input
                    type="text"
                    value={`${selectedSuplier.cabang.kode_cabang} - ${selectedSuplier.cabang.nama_cabang}`}
                    className="w-full px-3 py-2 border rounded bg-gray-100"
                    readOnly
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Cabang otomatis dari supplier yang dipilih
                  </p>
                </div>
              )}

              {/* Jenis Pembayaran */}
              <div>
                <label className="block mb-2 font-medium">Jenis Pembayaran</label>
                <select
                  value={formData.jenis_pembayaran}
                  onChange={(e) =>
                    setFormData({ ...formData, jenis_pembayaran: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Pilih Jenis Pembayaran</option>
                  <option value="hutang">Hutang</option>
                  <option value="tunai">Tunai</option>
                </select>
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
                disabled={loading}
                className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
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
