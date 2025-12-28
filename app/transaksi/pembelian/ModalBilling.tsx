'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';
import SingleOverlay from '../../../components/SingleOverlay';

interface Kas {
  id: number;
  nama_kas: string;
  no_rekening?: string;
  saldo: number;
}

interface PembelianData {
  id: number;
  tanggal: string;
  nota_supplier: string;
  jenis_pembayaran: string;
  total: number;
  uang_muka: number;
  biaya_kirim: number;
  cabang_id?: number;
  detail_pembelian?: {
    jumlah: number;
    harga: number;
  }[];
  suplier?: {
    nama: string;
    id?: number;
  };
  jatuh_tempo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPembelian?: any) => void;
  pembelianData: PembelianData | null;
}

export default function ModalBilling({ isOpen, onClose, onSuccess, pembelianData }: Props) {
  const [loading, setLoading] = useState(false);
  const [rekenings, setRekenings] = useState<Kas[]>([]);
  const [selectedKas, setSelectedKas] = useState<Kas | null>(null);
  
  const [formData, setFormData] = useState({
    uang_muka: '',
    biaya_kirim: '',
    rekening_bayar: '',
    jatuh_tempo: '',
  });

  // Ensure jatuh_tempo is always controlled
  const controlledJatuhTempo = formData.jatuh_tempo || '';

  const [calculatedData, setCalculatedData] = useState({
    total_harga_produk: 0,
    terbayar: 0,
    sisa_hutang: 0,
  });

  // Fetch rekening saat modal dibuka
  useEffect(() => {
    if (isOpen && pembelianData) {
      fetchRekenings();
      setFormData({
        uang_muka: String(pembelianData.uang_muka || 0),
        biaya_kirim: String(pembelianData.biaya_kirim || 0),
        rekening_bayar: '',
        jatuh_tempo: pembelianData.jenis_pembayaran?.toLowerCase() === 'hutang' ? (pembelianData.jatuh_tempo ? new Date(pembelianData.jatuh_tempo).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) : '', // Use existing or default 30 days for hutang (case-insensitive)
      });
      setSelectedKas(null);
    }
  }, [isOpen, pembelianData]);

  const fetchRekenings = async () => {
    try {
      const url = pembelianData?.cabang_id 
        ? `/api/master/kas?cabang_id=${pembelianData.cabang_id}`
        : '/api/master/kas';
      
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.data && json.data.length > 0) {
        const parsedData = json.data.map((rek: any) => ({
          ...rek,
          saldo: parseFloat(rek.saldo) || 0
        }));
        setRekenings(parsedData);
      } else {
        setRekenings([]);
      }
    } catch (error) {
      console.error('Error fetching rekenings:', error);
      setRekenings([]);
    }
  };

  // Hitung total
  useEffect(() => {
    if (!pembelianData) return;

    const preview = {
      ...pembelianData,
      biaya_kirim: parseInt(formData.biaya_kirim) || 0,
      uang_muka: parseInt(formData.uang_muka) || 0,
    } as any;

    const { subtotal, finalTotal } = calculatePembelianTotals(preview);
    const uangMuka = Number(preview.uang_muka || 0);

    setCalculatedData({
      total_harga_produk: subtotal,
      terbayar: uangMuka,
      sisa_hutang: Math.max(0, finalTotal - uangMuka),
    });
  }, [pembelianData, formData.uang_muka, formData.biaya_kirim]);

  const handleChangeNumber = (field: 'uang_muka' | 'biaya_kirim', value: string) => {
    const filtered = value.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, [field]: filtered }));
  };

  const handleRekeningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const namaKas = e.target.value;
    const kas = rekenings.find(k => k.nama_kas === namaKas);
    setSelectedKas(kas || null);
    setFormData((prev) => ({ ...prev, rekening_bayar: namaKas }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pembelianData) return;

    const uangMuka = parseInt(formData.uang_muka) || 0;

    // Validasi: jika ada uang muka, rekening wajib dipilih
    if (uangMuka > 0 && !formData.rekening_bayar) {
      alert('Pilih rekening pembayaran untuk DP');
      return;
    }

    // Validasi saldo kas
    if (uangMuka > 0 && selectedKas && uangMuka > selectedKas.saldo) {
      alert(`Saldo kas tidak cukup! Saldo tersedia: Rp ${selectedKas.saldo.toLocaleString('id-ID')}`);
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        uang_muka: uangMuka,
        biaya_kirim: parseInt(formData.biaya_kirim) || 0,
        rekening_bayar: formData.rekening_bayar || null,
        suplier_id: pembelianData.suplier?.id,
      };

      // Add jatuh_tempo for hutang payments (case-insensitive)
      if (pembelianData.jenis_pembayaran?.toLowerCase() === 'hutang') {
        payload.jatuh_tempo = formData.jatuh_tempo;
      }

      const res = await fetch(`/api/transaksi/pembelian/${pembelianData.id}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Billing berhasil');
        onSuccess(json?.pembelian);
        onClose();
      } else {
        alert(json.error || 'Gagal proses billing');
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !pembelianData) return null;

  const hasDP = parseInt(formData.uang_muka) > 0;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Memproses Billing Pembelian...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-yellow-100 px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">BILLING PEMBELIAN BARANG</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Info */}
        <div className="p-4 bg-blue-50 border-b">
          <p className="text-sm text-blue-800">
            <strong>💡 Info:</strong> Anda bisa bayar DP sekarang atau kosongkan jika bayar nanti via menu Pelunasan/Cicilan.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tgl Beli */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Tgl Beli</label>
            <input
              type="text"
              value={new Date(pembelianData.tanggal).toLocaleDateString('id-ID')}
              disabled
              className="col-span-2 px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Supplier / Nota */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Supplier / Nota</label>
            <input
              type="text"
              value={`${pembelianData.suplier?.nama || '-'} / ${pembelianData.nota_supplier}`}
              disabled
              className="col-span-2 px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Jenis Pembayaran */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Jenis Pembayaran</label>
            <input
              type="text"
              value={pembelianData.jenis_pembayaran === 'tunai' ? 'Tunai' : 'Hutang'}
              disabled
              className="col-span-2 px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Jatuh Tempo - Only show for hutang payments */}
          {(() => {
            console.log('Checking jatuh tempo condition:', pembelianData.jenis_pembayaran?.toLowerCase() === 'hutang', pembelianData.jenis_pembayaran);
            return pembelianData.jenis_pembayaran?.toLowerCase() === 'hutang';
          })() && (
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="font-medium">
                Jatuh Tempo <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="date"
                  value={controlledJatuhTempo}
                  onChange={(e) => setFormData({ ...formData, jatuh_tempo: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={pembelianData.jenis_pembayaran?.toLowerCase() === 'hutang'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tanggal kapan hutang pembelian harus dilunasi
                </p>
              </div>
            </div>
          )}

          {/* Biaya Kirim */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Biaya Kirim</label>
            <div className="col-span-2">
              <input
                type="text"
                value={formData.biaya_kirim}
                onChange={(e) => handleChangeNumber('biaya_kirim', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Rp 0"
              />
            </div>
          </div>

          <hr className="my-4" />

          {/* DP / Uang Muka (OPSIONAL) */}
          <div className="bg-green-50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-green-800">💰 Pembayaran DP (Opsional)</h3>
            
            {/* Uang Muka */}
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="font-medium text-sm">DP / Uang Muka</label>
              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.uang_muka}
                  onChange={(e) => handleChangeNumber('uang_muka', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Rp 0 (kosongkan jika bayar nanti)"
                />
              </div>
            </div>

            {/* Rekening Bayar */}
            {hasDP && (
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-medium text-sm">
                  Rekening Bayar <span className="text-red-500">*</span>
                </label>
                <div className="col-span-2">
                  <select
                    value={formData.rekening_bayar}
                    onChange={handleRekeningChange}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Pilih Rekening --</option>
                    {rekenings.map((rek) => (
                      <option key={rek.id} value={rek.nama_kas}>
                        {rek.nama_kas} {rek.no_rekening ? `(${rek.no_rekening})` : ''} - Rp {rek.saldo.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                  {rekenings.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Tidak ada rekening tersedia</p>
                  )}
                  {selectedKas && (
                    <p className="text-xs text-green-700 mt-1">
                      Saldo tersedia: Rp {selectedKas.saldo.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <hr className="my-4" />

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Harga Produk:</span>
              <span className="font-semibold">Rp {calculatedData.total_harga_produk.toLocaleString('id-ID')}</span>
            </div>
            
            {hasDP && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">DP yang Dibayar:</span>
                <span className="font-semibold text-green-600">- Rp {calculatedData.terbayar.toLocaleString('id-ID')}</span>
              </div>
            )}
            
            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold">Sisa Hutang:</span>
              <span className="font-bold text-red-600">Rp {calculatedData.sisa_hutang.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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
