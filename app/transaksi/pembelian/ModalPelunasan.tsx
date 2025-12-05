'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Kas {
  id: number;
  nama_kas: string;
  no_rekening?: string;
  saldo: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPembelian?: any) => void;
  pembelianId: number;
  sisaTagihan: number;
  cabangId?: number;
}

export default function ModalPelunasan({
  isOpen,
  onClose,
  onSuccess,
  pembelianId,
  sisaTagihan,
  cabangId,
}: Props) {
  const [rekenings, setRekenings] = useState<Kas[]>([]);
  const [selectedKas, setSelectedKas] = useState<Kas | null>(null);
  const [formData, setFormData] = useState<{
    rekening: string;
    nilai_diskon: number;
  }>({
    rekening: '',
    nilai_diskon: 0,
  });
  const [loading, setLoading] = useState(false);

  const remainingAfterPelunasan = Math.max(0, sisaTagihan - (formData.nilai_diskon || 0));
  const isDiskonOver = (formData.nilai_diskon || 0) > sisaTagihan;

  useEffect(() => {
    if (isOpen) {
      fetchRekenings();
      setFormData({
        rekening: '',
        nilai_diskon: 0,
      });
      setSelectedKas(null);
    }
  }, [isOpen]);

  const fetchRekenings = async () => {
    try {
      const url = cabangId 
        ? `/api/master/kas?cabang_id=${cabangId}`
        : '/api/master/kas';
      
      console.log('Fetching rekenings from:', url);
      
      const res = await fetch(url);
      const json = await res.json();
      
      console.log('Rekenings response:', json);
      
      if (json.data && json.data.length > 0) {
        // Parse saldo to number
        const parsedData = json.data.map((rek: any) => ({
          ...rek,
          saldo: parseFloat(rek.saldo) || 0
        }));
        setRekenings(parsedData);
        console.log('Rekenings set successfully:', parsedData.length, 'items');
      } else {
        console.warn('No rekenings data found');
        setRekenings([]);
      }
    } catch (error) {
      console.error('Error fetching rekenings:', error);
      setRekenings([]);
    }
  };

  const handleRekeningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const namaKas = e.target.value;
    const kas = rekenings.find(k => k.nama_kas === namaKas);
    setSelectedKas(kas || null);
    setFormData({ ...formData, rekening: namaKas });
  };

  const calculateNilaiPelunasan = () => {
    return sisaTagihan - (formData.nilai_diskon || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi diskon tidak boleh lebih dari sisa tagihan
    if (formData.nilai_diskon > sisaTagihan) {
      alert('Nilai diskon tidak boleh melebihi sisa tagihan');
      return;
    }

    const nilaiPelunasan = calculateNilaiPelunasan();

    // Validasi saldo kas
    if (selectedKas && nilaiPelunasan > selectedKas.saldo) {
      alert(`Saldo kas tidak cukup! Saldo tersedia: Rp. ${selectedKas.saldo.toLocaleString('id-ID')}`);
      return;
    }

    if (nilaiPelunasan < 0) {
      alert('Nilai diskon terlalu besar');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}/lunas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rekening: formData.rekening,
          nilai_diskon: formData.nilai_diskon,
          keterangan: formData.nilai_diskon > 0
            ? `Pelunasan dengan diskon Rp. ${formData.nilai_diskon.toLocaleString('id-ID')}`
            : 'Pelunasan',
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Pembayaran berhasil dilunasi');
        setFormData({
          rekening: '',
          nilai_diskon: 0,
        });
        onSuccess(); // Call onSuccess without parameters to trigger data refresh
        onClose();
      } else {
        alert('Gagal melunasi: ' + json.error);
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
      nilai_diskon: 0,
    });
    setSelectedKas(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Pelunasan Hutang Pembelian</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Summary Hutang */}
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Sisa Hutang:</span>
            <span className="font-semibold text-red-600">
              Rp. {sisaTagihan.toLocaleString('id-ID')}
            </span>
          </div>
          {formData.nilai_diskon > 0 && (
            <>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Diskon:</span>
                <span className="font-semibold text-green-600">
                  - Rp. {formData.nilai_diskon.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">Yang Akan Dibayar:</span>
                <span className="font-bold text-blue-600">
                  Rp. {calculateNilaiPelunasan().toLocaleString('id-ID')}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between mt-2">
            <span className="text-sm text-gray-600">Sisa setelah pelunasan:</span>
            <span className={`font-semibold ${isDiskonOver ? 'text-red-500' : 'text-gray-700'}`}>
              Rp. {remainingAfterPelunasan.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Pilih Rekening <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.rekening}
              onChange={handleRekeningChange}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Pilih Rekening --</option>
              {rekenings.map((rek) => (
                <option key={rek.id} value={rek.nama_kas}>
                  {rek.nama_kas} {rek.no_rekening ? `(${rek.no_rekening})` : ''} - Rp. {rek.saldo.toLocaleString('id-ID')}
                </option>
              ))}
            </select>
            {rekenings.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Tidak ada rekening tersedia untuk cabang ini
              </p>
            )}
            {selectedKas && (
              <p className="text-xs text-blue-600 mt-1">
                Saldo tersedia: Rp. {selectedKas.saldo.toLocaleString('id-ID')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nilai Diskon (Opsional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={sisaTagihan}
              value={formData.nilai_diskon || ''}
              onChange={(e) =>
                setFormData({ ...formData, nilai_diskon: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Masukkan nilai diskon (jika ada)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Diskon maksimal: Rp. {sisaTagihan.toLocaleString('id-ID')}
            </p>
          </div>

          {formData.nilai_diskon > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total yang akan dibayar:</span>
                <span className="text-lg font-bold text-blue-600">
                  Rp. {calculateNilaiPelunasan().toLocaleString('id-ID')}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Sisa Tagihan (Rp. {sisaTagihan.toLocaleString('id-ID')}) - Diskon (Rp. {formData.nilai_diskon.toLocaleString('id-ID')})
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={Boolean(
              loading ||
              formData.nilai_diskon < 0 ||
              isDiskonOver ||
              (selectedKas && calculateNilaiPelunasan() > selectedKas.saldo)
            )}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Lunasi'}
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
  );
}
