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
  editingCicilan: any; // Required for edit mode
}

export default function ModalEditCicil({
  isOpen,
  onClose,
  onSuccess,
  pembelianId,
  sisaTagihan,
  cabangId,
  editingCicilan,
}: Props) {
  const [rekenings, setRekenings] = useState<any[]>([]);
  const [originalNilaiCicilan, setOriginalNilaiCicilan] = useState(0);
  const [formData, setFormData] = useState({
    rekening: '',
    tanggal_cicilan: new Date().toISOString().split('T')[0],
    nilai_cicilan: 0,
    keterangan: '',
  });
  const [loading, setLoading] = useState(false);

  // ✅ FIX: Hitung maksimal cicilan yang bisa diinput
  // Rumus: sisaTagihan + nilai cicilan original (karena akan diganti)
  const maxCicilan = sisaTagihan + originalNilaiCicilan;
  
  // Remaining tagihan after entering nilai_cicilan (preview)
  const remainingAfter = Math.max(0, maxCicilan - (formData.nilai_cicilan || 0));
  const isOver = (formData.nilai_cicilan || 0) > maxCicilan;

  // Populate form with editing data
  useEffect(() => {
    if (isOpen && editingCicilan) {
      const originalValue = editingCicilan.jumlah_cicilan || 0;
      setOriginalNilaiCicilan(originalValue);
      setFormData({
        rekening: editingCicilan.rekening || '',
        tanggal_cicilan: editingCicilan.tanggal_cicilan || new Date().toISOString().split('T')[0],
        nilai_cicilan: originalValue,
        keterangan: editingCicilan.keterangan || '',
      });
    }
  }, [isOpen, editingCicilan]);

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

    // ✅ FIX: Validasi menggunakan maxCicilan, bukan sisaTagihan
    if (formData.nilai_cicilan > maxCicilan) {
      alert(`Nilai cicilan tidak boleh melebihi Rp. ${maxCicilan.toLocaleString('id-ID')}`);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        cicilanId: editingCicilan.id,
        tanggal_cicilan: formData.tanggal_cicilan,
        jumlah_cicilan: formData.nilai_cicilan,
        rekening: formData.rekening,
        keterangan: formData.keterangan,
      };

      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}/cicilan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Cicilan berhasil diperbarui');
        onSuccess(json?.pembelian);
        onClose();
      } else {
        alert('Gagal memperbarui cicilan: ' + json.error);
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
      keterangan: '',
    });
    setOriginalNilaiCicilan(0);
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
              <p className="text-lg font-semibold text-gray-800">Memperbarui Cicilan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Cicilan Pembelian</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Summary Hutang */}
        <div className="mb-4 p-4 bg-blue-50 rounded space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Sisa Hutang Saat Ini:</span>
            <span className="font-bold text-red-600">
              Rp. {sisaTagihan.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Nilai Cicilan Original:</span>
            <span className="font-semibold text-blue-600">
              Rp. {originalNilaiCicilan.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-blue-200">
            <span className="text-sm font-semibold text-gray-700">Maksimal Cicilan Baru:</span>
            <span className="font-bold text-green-600">
              Rp. {maxCicilan.toLocaleString('id-ID')}
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
              Maksimal: Rp. {maxCicilan.toLocaleString('id-ID')}
            </p>
            
            {/* Preview perubahan */}
            {formData.nilai_cicilan !== originalNilaiCicilan && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  <strong>Perubahan:</strong> 
                  <br />
                  Rp. {originalNilaiCicilan.toLocaleString('id-ID')} → 
                  Rp. {(formData.nilai_cicilan || 0).toLocaleString('id-ID')}
                  <br />
                  <span className={formData.nilai_cicilan > originalNilaiCicilan ? 'text-red-600' : 'text-green-600'}>
                    ({formData.nilai_cicilan > originalNilaiCicilan ? '+' : ''}{((formData.nilai_cicilan || 0) - originalNilaiCicilan).toLocaleString('id-ID')})
                  </span>
                </p>
              </div>
            )}
            
            <p className={`text-xs mt-1 ${isOver ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
              Sisa hutang setelah cicilan: Rp. {remainingAfter.toLocaleString('id-ID')}
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
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Masukkan keterangan cicilan..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || formData.nilai_cicilan <= 0 || isOver}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Update'}
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
