'use client';

import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import SingleOverlay from '../../../../components/SingleOverlay';

interface ModalTerimaPenjualanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  penjualanId: number;
}

export default function ModalTerimaPenjualan({
  isOpen,
  onClose,
  onSuccess,
  penjualanId,
}: ModalTerimaPenjualanProps) {
  const [formData, setFormData] = useState({
    tanggal_diterima: new Date().toISOString().split('T')[0],
    diterima_oleh: '',
    catatan: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.diterima_oleh.trim()) {
      alert('Nama penerima harus diisi');
      return;
    }

    const konfirmasi = confirm(
      `Konfirmasi Penerimaan Barang:\n\n` +
      `Tanggal: ${new Date(formData.tanggal_diterima).toLocaleDateString('id-ID')}\n` +
      `Diterima oleh: ${formData.diterima_oleh}\n\n` +
      `Lanjutkan?`
    );

    if (!konfirmasi) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/terima`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert('✅ Barang berhasil dikonfirmasi diterima!');
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal mengkonfirmasi penerimaan');
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Mengkonfirmasi Penerimaan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={24} />
            <h2 className="text-xl font-bold">Konfirmasi Penerimaan Barang</h2>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ Konfirmasi bahwa barang sudah diterima oleh customer dengan lengkap dan sesuai.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Diterima <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.tanggal_diterima}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_diterima: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Diterima Oleh <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.diterima_oleh}
              onChange={(e) =>
                setFormData({ ...formData, diterima_oleh: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
              placeholder="Nama penerima..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Catatan (Opsional)
            </label>
            <textarea
              value={formData.catatan}
              onChange={(e) =>
                setFormData({ ...formData, catatan: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Catatan tambahan..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : '✅ Konfirmasi Diterima'}
            </button>
          </div>
        </form>
      </div>
    </div>
      )}
    </SingleOverlay>
  );
}
