'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculatePenjualanTotals } from '@/lib/transaksi/calculateTotals';
import SingleOverlay from '../../../../components/SingleOverlay';

interface ModalCicilanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  penjualanId: number;
}

interface Kas {
  id: number;
  nama_kas: string;
  saldo: number;
  no_rekening?: string;
}

interface CicilanItem {
  id: number;
  jumlah_cicilan: number;
}

interface Penjualan {
  id: number;
  detail_penjualan: Array<{ subtotal: number }>;
  biaya_ongkir?: number;
  biaya_potong?: number;
  nilai_diskon?: number;
  uang_muka?: number;
  pegawai?: {
    cabang_id?: number;
  };
}

export default function ModalCicilan({
  isOpen,
  onClose,
  onSuccess,
  penjualanId,
}: ModalCicilanProps) {
  const [formData, setFormData] = useState({
    kas_id: 0,
    tanggal_cicilan: new Date().toISOString().split('T')[0],
    jumlah_cicilan: 0,
    keterangan: '',
  });
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [selectedKas, setSelectedKas] = useState<Kas | null>(null);
  const [penjualan, setPenjualan] = useState<Penjualan | null>(null);
  const [cicilans, setCicilans] = useState<CicilanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKas, setLoadingKas] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPenjualan();
      fetchCicilans();
      // Reset form
      setFormData({
        kas_id: 0,
        tanggal_cicilan: new Date().toISOString().split('T')[0],
        jumlah_cicilan: 0,
        keterangan: '',
      });
      setSelectedKas(null);
    }
  }, [isOpen]);

  // Fetch kas accounts when penjualan data is loaded
  useEffect(() => {
    if (penjualan) {
      fetchKas();
    }
  }, [penjualan]);

  const fetchKas = async () => {
    try {
      setLoadingKas(true);
      // Get cabang_id from penjualan data to filter kas by branch
      const cabangId = penjualan?.pegawai?.cabang_id;
      const url = cabangId ? `/api/master/kas?cabang_id=${cabangId}` : '/api/master/kas';
      const res = await fetch(url);
      const json = await res.json();
      setKasList(json.data || []);
    } catch (error) {
      console.error('Error fetching kas:', error);
      setKasList([]);
    } finally {
      setLoadingKas(false);
    }
  };

  const fetchPenjualan = async () => {
    try {
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}`);
      const json = await res.json();
      setPenjualan(json.data);
    } catch (error) {
      console.error('Error fetching penjualan:', error);
    }
  };

  const fetchCicilans = async () => {
    try {
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/cicilan`);
      const json = await res.json();
      setCicilans(json.data || []);
    } catch (error) {
      console.error('Error fetching cicilans:', error);
      setCicilans([]);
    }
  };

  const calculateTotalCicilan = () => {
    return cicilans.reduce((sum, c) => sum + Number(c.jumlah_cicilan || 0), 0);
  };

  const calculateInfo = () => {
    if (!penjualan) {
      return { totalPiutang: 0, sudahDibayar: 0, sisaTagihan: 0 };
    }

    const totalCicilan = calculateTotalCicilan();
    const { finalTotal, tagihan } = calculatePenjualanTotals(penjualan as any, {
      totalCicilan,
    });

    const uangMuka = Number(penjualan.uang_muka || 0);
    const sudahDibayar = uangMuka + totalCicilan;

    return {
      totalPiutang: finalTotal,
      sudahDibayar,
      sisaTagihan: tagihan,
    };
  };

  const handleKasChange = (kasId: number) => {
    const kas = kasList.find((k) => k.id === kasId);
    setSelectedKas(kas || null);
    setFormData({ ...formData, kas_id: kasId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.kas_id === 0) {
      alert('Pilih rekening terlebih dahulu');
      return;
    }

    if (formData.jumlah_cicilan <= 0) {
      alert('Nilai cicilan harus lebih dari 0');
      return;
    }

    const { sisaTagihan } = calculateInfo();

    // Validasi cicilan tidak melebihi sisa tagihan
    if (formData.jumlah_cicilan > sisaTagihan) {
      alert(
        `Nilai cicilan melebihi sisa tagihan.\nSisa tagihan: Rp. ${sisaTagihan.toLocaleString('id-ID')}`
      );
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/cicilan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (res.ok) {
        const sisaBaru = sisaTagihan - formData.jumlah_cicilan;
        alert(`Cicilan berhasil diproses!\nSisa tagihan: Rp. ${sisaBaru.toLocaleString('id-ID')}`);
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Gagal memproses cicilan');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const { totalPiutang, sudahDibayar, sisaTagihan } = calculateInfo();

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menambahkan Cicilan Penjualan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 rounded-lg p-6 w-full max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cicilan Penjualan</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Info Piutang */}
        <div className="bg-white p-4 rounded mb-4 border">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Total Piutang:</span>
              <p className="text-lg font-bold">
                Rp. {totalPiutang.toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <span className="font-medium">Sudah Dibayar:</span>
              <p className="text-lg font-bold text-green-600">
                Rp. {sudahDibayar.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="col-span-2">
              <span className="font-medium">Sisa Tagihan:</span>
              <p className="text-xl font-bold text-red-600">
                Rp. {sisaTagihan.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilih Rekening */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Pilih Rekening <span className="text-red-500">*</span>
            </label>
            {loadingKas ? (
              <input
                type="text"
                value="Loading..."
                disabled
                className="w-full px-3 py-2 border rounded bg-gray-100"
              />
            ) : (
              <select
                value={formData.kas_id}
                onChange={(e) => handleKasChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded"
                required
              >
                <option value={0}>-- Pilih Rekening --</option>
                {kasList.map((kas) => (
                  <option key={kas.id} value={kas.id}>
                    {kas.nama_kas} {kas.no_rekening ? `(${kas.no_rekening})` : ''} - Saldo: Rp. {Number(kas.saldo).toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              💡 Kas akan bertambah sesuai nilai cicilan yang diterima
            </p>
          </div>

          {/* Tanggal Cicilan */}
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Cicilan</label>
            <input
              type="date"
              value={formData.tanggal_cicilan}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_cicilan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          {/* Nilai Cicilan */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nilai Cicilan <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.jumlah_cicilan || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jumlah_cicilan: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border rounded"
              placeholder="Masukkan jumlah cicilan"
              min="0"
              step="0.01"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Maksimal: Rp. {sisaTagihan.toLocaleString('id-ID')}
            </p>
          </div>

          {/* Preview Sisa */}
          {formData.jumlah_cicilan > 0 && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-1">Setelah Cicilan:</p>
              <div className="flex justify-between text-sm">
                <span>Sisa Tagihan:</span>
                <span className="font-bold text-blue-600">
                  Rp. {Math.max(0, sisaTagihan - formData.jumlah_cicilan).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          )}

          {/* Keterangan */}
          <div>
            <label className="block text-sm font-medium mb-1">Keterangan (Optional)</label>
            <textarea
              value={formData.keterangan}
              onChange={(e) =>
                setFormData({ ...formData, keterangan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="Keterangan..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-center mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || loadingKas}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
      )}
    </SingleOverlay>
  );
}
