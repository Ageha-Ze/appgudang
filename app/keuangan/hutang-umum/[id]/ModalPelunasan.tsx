'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Kas {
  id: number;
  nama_kas: string;
  saldo: number;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hutangId: number;
  sisaHutang: number;
}

export default function ModalPelunasan({
  isOpen,
  onClose,
  onSuccess,
  hutangId,
  sisaHutang,
}: ModalProps) {
  const [kas_id, setKasId] = useState('');
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSisa, setCurrentSisa] = useState(sisaHutang);
  const [tanggal_cicilan, setTanggalCicilan] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (isOpen) {
      fetchKas();
      fetchCurrentSisa();
      setTanggalCicilan(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);

  useEffect(() => {
    setCurrentSisa(sisaHutang);
  }, [sisaHutang]);

  const fetchKas = async () => {
    try {
      const res = await fetch('/api/master/kas');
      const json = await res.json();
      setKasList(json.data || []);
    } catch (error) {
      console.error('Error fetching kas:', error);
    }
  };

  const fetchCurrentSisa = async () => {
    try {
      const res = await fetch(`/api/keuangan/hutang-umum/${hutangId}`);
      const json = await res.json();
      if (json.data) {
        setCurrentSisa(Number(json.data.sisa));
      }
    } catch (error) {
      console.error('Error fetching current sisa:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!kas_id) {
      alert('Pilih rekening terlebih dahulu');
      return;
    }

    if (currentSisa <= 0) {
      alert('Hutang sudah lunas');
      handleClose(); // ✅ Close modal jika sudah lunas
      return;
    }

    // Validasi saldo kas
    const selectedKas = kasList.find(k => k.id === parseInt(kas_id));
    if (selectedKas && selectedKas.saldo < currentSisa) {
      alert(`Saldo kas ${selectedKas.nama_kas} tidak mencukupi. Saldo tersedia: Rp. ${selectedKas.saldo.toLocaleString('id-ID')}`);
      return;
    }

    if (!confirm(`Konfirmasi pelunasan sebesar Rp. ${currentSisa.toLocaleString('id-ID')}?`)) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/keuangan/hutang-umum/${hutangId}/cicilan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal_cicilan,
          jumlah_cicilan: currentSisa,
          kas_id: parseInt(kas_id),
          keterangan: 'Pelunasan',
          is_pelunasan: true,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Hutang berhasil dilunasi');
        
        // ✅ IMPORTANT: Close modal FIRST before calling onSuccess
        handleClose();
        
        // ✅ Small delay to ensure modal is closed before refresh
        setTimeout(() => {
          onSuccess();
        }, 100);
      } else {
        alert(json.error || 'Gagal melunasi hutang');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setKasId('');
    setTanggalCicilan(new Date().toISOString().split('T')[0]);
    onClose(); // ✅ Call onClose to close modal
  };

  if (!isOpen) return null;

  const selectedKas = kasList.find(k => k.id === parseInt(kas_id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Pelunasan Hutang</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="bg-red-50 p-4 rounded mb-4">
          <p className="text-sm text-gray-600">Sisa Hutang:</p>
          <p className="text-2xl font-bold text-red-600">
            Rp. {currentSisa.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded mb-4">
          <p className="text-sm text-gray-600">Sisa setelah pelunasan:</p>
          <p className="text-2xl font-bold text-green-600">Rp. 0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Pelunasan <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tanggal_cicilan}
              onChange={(e) => setTanggalCicilan(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Pilih Rekening <span className="text-red-500">*</span>
            </label>
            <select
              value={kas_id}
              onChange={(e) => setKasId(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">-- Pilih Rekening --</option>
              {kasList.map((kas) => (
                <option key={kas.id} value={kas.id}>
                  {kas.nama_kas} - Saldo: Rp. {kas.saldo.toLocaleString('id-ID')}
                </option>
              ))}
            </select>
            {selectedKas && selectedKas.saldo < currentSisa && (
              <p className="text-xs text-red-500 mt-1">
                ⚠️ Saldo tidak mencukupi untuk pelunasan
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading || !selectedKas || selectedKas.saldo < currentSisa}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
