'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPembelian?: any) => void;
  pembelianId: number;
  sisaTagihan: number;
  cabangId?: number;
}

export default function ModalCicil({
  isOpen,
  onClose,
  onSuccess,
  pembelianId,
  sisaTagihan,
  cabangId,
}: Props) {
  const [rekenings, setRekenings] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    rekening: '',
    tanggal_cicilan: new Date().toISOString().split('T')[0],
    nilai_cicilan: 0,
    tipe_cicilan: 'cicilan', // Transaction type for cicilan
    keterangan: '',
  });

  const [loading, setLoading] = useState(false);

  // Remaining tagihan after entering nilai_cicilan (preview)
  const remainingAfter = Math.max(0, sisaTagihan - (formData.nilai_cicilan || 0));
  const isOver = (formData.nilai_cicilan || 0) > sisaTagihan;

  useEffect(() => {
    if (isOpen) {
      fetchRekenings();
    }
  }, [isOpen]);

  const fetchRekenings = async () => {
    try {
      // Fetch dengan filter cabang jika ada, atau semua jika tidak ada
      const url = cabangId 
        ? `/api/master/kas?cabang_id=${cabangId}`
        : '/api/master/kas';
      
      console.log('Fetching rekenings from:', url);
      
      const res = await fetch(url);
      const json = await res.json();
      
      console.log('Rekenings response:', json);
      
      if (json.data && json.data.length > 0) {
        setRekenings(json.data);
        console.log('Rekenings set successfully:', json.data.length, 'items');
      } else {
        console.warn('No rekenings data found');
        setRekenings([]);
      }
    } catch (error) {
      console.error('Error fetching rekenings:', error);
      setRekenings([]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.nilai_cicilan <= 0) {
      alert('Nilai cicilan harus lebih dari 0');
      return;
    }

    if (formData.nilai_cicilan > sisaTagihan) {
      alert('Nilai cicilan tidak boleh melebihi sisa tagihan');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}/cicilan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal_cicilan: formData.tanggal_cicilan,
          jumlah_cicilan: formData.nilai_cicilan,
          rekening: formData.rekening,
          jenis_pembayaran: "cicilan",
          tipe_cicilan: formData.tipe_cicilan,
          keterangan: formData.keterangan, // ✅ FIX: Gunakan value dari formData
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Cicilan berhasil ditambahkan');
        setFormData({
          rekening: '',
          tanggal_cicilan: new Date().toISOString().split('T')[0],
          nilai_cicilan: 0,
          tipe_cicilan: 'cash',
          keterangan: '',
        });
        onSuccess(json?.pembelian);
        onClose();
      } else {
        alert('Gagal menambahkan cicilan: ' + json.error);
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      rekening: '',
      tanggal_cicilan: new Date().toISOString().split('T')[0],
      nilai_cicilan: 0,
      tipe_cicilan: 'cash',
      keterangan: '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menambahkan Cicilan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Tambah Cicilan Pembelian</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Summary Hutang */}
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Sisa Hutang:</span>
            <span className="font-bold text-red-600">
              Rp. {sisaTagihan.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Cicilan <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.tanggal_cicilan}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_cicilan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nilai Cicilan <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Masukkan jumlah cicilan"
              value={formData.nilai_cicilan || ''}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === '' ? 0 : parseFloat(raw);
                setFormData({ ...formData, nilai_cicilan: Number.isNaN(parsed) ? 0 : parsed });
              }}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
            <p className="text-xs mt-1 text-gray-600">
              Maksimal: Rp. {sisaTagihan.toLocaleString('id-ID')}
            </p>
            <p className={`text-xs mt-1 ${isOver ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
              Sisa setelah cicilan: Rp. {remainingAfter.toLocaleString('id-ID')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Pilih Rekening <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.rekening}
              onChange={(e) =>
                setFormData({ ...formData, rekening: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Pilih Rekening --</option>
              {rekenings.map((rek) => (
                <option key={rek.id} value={rek.nama_kas}>
                  {rek.nama_kas} {rek.no_rekening ? `(${rek.no_rekening})` : ''} {rek.saldo ? `- Rp. ${rek.saldo.toLocaleString('id-ID')}` : ''}
                </option>
              ))}
            </select>
            {rekenings.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Tidak ada rekening tersedia untuk cabang ini
              </p>
            )}
          </div>



          <div>
            <label className="block text-sm font-medium mb-1">
              Keterangan
            </label>
            <textarea
              placeholder="Opsional — contoh: cicilan ke-2, pelunasan DP, dll"
              value={formData.keterangan}
              onChange={(e) =>
                setFormData({ ...formData, keterangan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Catatan tambahan untuk cicilan ini (opsional)
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || formData.nilai_cicilan <= 0 || isOver}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
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
