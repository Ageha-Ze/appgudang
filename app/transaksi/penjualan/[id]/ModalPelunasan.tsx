'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculatePenjualanTotals } from '@/lib/transaksi/calculateTotals';

interface ModalPelunasanProps {
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

export default function ModalPelunasan({
  isOpen,
  onClose,
  onSuccess,
  penjualanId,
}: ModalPelunasanProps) {
  const [formData, setFormData] = useState({
    kas_id: 0,
    tanggal_pelunasan: new Date().toISOString().split('T')[0],
    nilai_diskon: 0,
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
      setFormData({
        kas_id: 0,
        tanggal_pelunasan: new Date().toISOString().split('T')[0],
        nilai_diskon: 0,
      });
      setSelectedKas(null);
    }
  }, [isOpen, penjualanId]);

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

  const calculateJumlahPelunasan = () => {
    const { sisaTagihan } = calculateInfo();
    const jumlahPelunasan = Math.max(0, sisaTagihan - (formData.nilai_diskon || 0));

    return jumlahPelunasan;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.kas_id === 0) {
      alert('Pilih rekening terlebih dahulu');
      return;
    }

    const jumlahPelunasan = calculateJumlahPelunasan();
    const { sisaTagihan } = calculateInfo();

    if (formData.nilai_diskon > sisaTagihan) {
      alert('Nilai diskon tidak boleh melebihi sisa tagihan');
      return;
    }

    if (sisaTagihan <= 0) {
      alert('Tidak ada sisa tagihan yang perlu dilunasi');
      return;
    }

    // Konfirmasi
    const konfirmasi = confirm(
      `Konfirmasi Pelunasan:\n\n` +
      `Sisa Tagihan: Rp. ${sisaTagihan.toLocaleString('id-ID')}\n` +
      `Diskon: Rp. ${formData.nilai_diskon.toLocaleString('id-ID')}\n` +
      `Yang Dibayar: Rp. ${jumlahPelunasan.toLocaleString('id-ID')}\n\n` +
      `Kas ${selectedKas?.nama_kas} akan bertambah Rp. ${jumlahPelunasan.toLocaleString('id-ID')}\n\n` +
      `Lanjutkan?`
    );

    if (!konfirmasi) return;

    try {
      setLoading(true);
      
      const payload = {
        kas_id: formData.kas_id,
        tanggal_pelunasan: formData.tanggal_pelunasan,
        nilai_diskon: formData.nilai_diskon,
      };


      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/pelunasan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert(
          `✅ Pelunasan berhasil diproses!\n\n` +
          `Jumlah dibayar: Rp. ${jumlahPelunasan.toLocaleString('id-ID')}\n` +
          `Status: LUNAS\n` +
          `Kas bertambah: Rp. ${jumlahPelunasan.toLocaleString('id-ID')}`
        );
        onSuccess();
        onClose();
      } else {
        alert(`❌ Gagal memproses pelunasan:\n${json.error || 'Unknown error'}`);
        console.error('Error response:', json);
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const { totalPiutang, sudahDibayar, sisaTagihan } = calculateInfo();
  const jumlahPelunasan = calculateJumlahPelunasan();

  return (
    <>
      {/* Full Screen Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Memproses Pelunasan Penjualan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Pelunasan Penjualan</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Info Piutang */}
        <div className="bg-white p-4 rounded mb-4 border border-blue-200">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Total Piutang:</span>
              <span className="font-bold">
                Rp. {totalPiutang.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Sudah Dibayar:</span>
              <span className="font-bold text-green-600">
                Rp. {sudahDibayar.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Sisa Tagihan:</span>
              <span className="text-xl font-bold text-red-600">
                Rp. {sisaTagihan.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* Debug Info (hapus di production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-blue-50 p-3 rounded mb-4 text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>Total Cicilan: {calculateTotalCicilan().toLocaleString('id-ID')}</p>
            <p>Uang Muka: {(penjualan?.uang_muka || 0).toLocaleString('id-ID')}</p>
            <p>Sisa Tagihan: {sisaTagihan.toLocaleString('id-ID')}</p>
            <p>Diskon: {formData.nilai_diskon.toLocaleString('id-ID')}</p>
            <p>Yang Dibayar: {jumlahPelunasan.toLocaleString('id-ID')}</p>
          </div>
        )}

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
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
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
            <p className="text-xs text-blue-600 mt-1">
              💡 Kas akan bertambah sesuai nilai pelunasan yang diterima
            </p>
          </div>

          {/* Tanggal Pelunasan */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Pelunasan <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.tanggal_pelunasan}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_pelunasan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Nilai Diskon */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nilai Diskon (Optional)
            </label>
            <input
              type="number"
              value={formData.nilai_diskon || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  nilai_diskon: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              min="0"
              max={sisaTagihan}
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maksimal: Rp. {sisaTagihan.toLocaleString('id-ID')}
            </p>
          </div>

          {/* Rincian Pelunasan */}
          <div className="p-4 bg-green-50 rounded border-2 border-green-200">
            <p className="text-sm font-bold text-green-800 mb-3">📋 Rincian Pelunasan:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sisa Tagihan:</span>
                <span className="font-bold">
                  Rp. {sisaTagihan.toLocaleString('id-ID')}
                </span>
              </div>
              {formData.nilai_diskon > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon:</span>
                  <span className="font-bold">
                    - Rp. {formData.nilai_diskon.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-green-300 pt-2 mt-2">
                <span className="font-bold text-green-800">Yang Harus Dibayar:</span>
                <span className="text-xl font-bold text-green-600">
                  Rp. {jumlahPelunasan.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Warning jika diskon terlalu besar */}
          {formData.nilai_diskon > sisaTagihan && (
            <div className="p-3 bg-red-50 border border-red-300 rounded">
              <p className="text-sm text-red-700">
                ⚠️ Nilai diskon melebihi sisa tagihan!
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-center mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || loadingKas || sisaTagihan <= 0 || formData.kas_id === 0}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : '✅ Proses Pelunasan'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
