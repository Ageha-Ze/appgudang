'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

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
  cabangId?: number;
  currentData: {
    uang_muka: number;
    biaya_kirim: number;
    rekening_bayar?: string;
  };
}

interface PropsWithSisa extends Props {
  sisaTagihan?: number;
  totalHutang?: number;
}

export default function ModalEditUangMuka({
  isOpen,
  onClose,
  onSuccess,
  pembelianId,
  cabangId,
  currentData,
  sisaTagihan = 0,
  totalHutang = 0,
}: PropsWithSisa) {
  const [rekenings, setRekenings] = useState<Kas[]>([]);
  const [selectedKas, setSelectedKas] = useState<Kas | null>(null);
  const [formData, setFormData] = useState({
    show_biaya_kirim: false,
    biaya_kirim: 0,
    show_uang_muka: false,
    uang_muka: 0,
    rekening: '',
    tanggal_edit: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  // Calculate remaining after new uang_muka
  const safeSisaTagihan = typeof sisaTagihan === 'number' ? sisaTagihan : 0;
  const safeTotalHutang = typeof totalHutang === 'number' && totalHutang > 0 ? totalHutang : 0;
  
  // Jika show_biaya_kirim checked, hitung ulang total hutang dengan biaya kirim baru
  const estimatedTotalHutang = formData.show_biaya_kirim 
    ? (safeTotalHutang - currentData.biaya_kirim + formData.biaya_kirim)
    : safeTotalHutang;
  
  // Total yang boleh dibayar dengan uang muka maksimal = total hutang (termasuk biaya kirim baru)
  const maxUangMuka = estimatedTotalHutang;
  
  // Sisa tagihan setelah uang muka baru
  const remainingAfterUangMuka = Math.max(0, estimatedTotalHutang - (formData.uang_muka || 0));
  const selisihUangMuka = formData.show_uang_muka ? Math.max(0, formData.uang_muka - currentData.uang_muka) : 0;
  const isUangMukaOverTotal = formData.show_uang_muka && formData.uang_muka > maxUangMuka;

  useEffect(() => {
    if (isOpen) {
      fetchRekenings();
      setFormData({
        show_biaya_kirim: currentData.biaya_kirim > 0,
        biaya_kirim: currentData.biaya_kirim,
        show_uang_muka: currentData.uang_muka > 0,
        uang_muka: currentData.uang_muka,
        rekening: currentData.rekening_bayar || '',
        tanggal_edit: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen, currentData]);

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
        const parsedData = json.data.map((rek: any) => ({
          ...rek,
          saldo: parseFloat(rek.saldo) || 0
        }));
        setRekenings(parsedData);
        console.log('Rekenings set successfully:', parsedData.length, 'items');
        
        if (currentData.rekening_bayar) {
          const kas = parsedData.find((k: Kas) => k.nama_kas === currentData.rekening_bayar);
          setSelectedKas(kas || null);
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi uang muka tidak melebihi total hutang (hanya jika total hutang > 0)
    if (formData.show_uang_muka && maxUangMuka > 0 && formData.uang_muka > maxUangMuka) {
      alert(`Uang muka tidak boleh melebihi total hutang: Rp. ${maxUangMuka.toLocaleString('id-ID')}`);
      return;
    }

    // Validasi saldo kas jika uang muka bertambah
    if (formData.show_uang_muka && formData.uang_muka > currentData.uang_muka) {
      const selisihUangMuka = formData.uang_muka - currentData.uang_muka;
      
      if (!formData.rekening) {
        alert('Pilih rekening pembayaran untuk penambahan uang muka');
        return;
      }
      
      if (selectedKas && selisihUangMuka > selectedKas.saldo) {
        alert(`Saldo kas tidak cukup!\nSaldo tersedia: Rp. ${selectedKas.saldo.toLocaleString('id-ID')}\nDibutuhkan: Rp. ${selisihUangMuka.toLocaleString('id-ID')}`);
        return;
      }
    }

    // Konfirmasi
    if (!confirm('Update uang muka dan biaya kirim? Perubahan akan mempengaruhi saldo kas dan history cicilan.')) {
      return;
    }

    setLoading(true);

    try {
      // 🔥 Gunakan API endpoint baru /uang-muka
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}/uang-muka`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uang_muka: formData.show_uang_muka ? formData.uang_muka : 0,
          biaya_kirim: formData.show_biaya_kirim ? formData.biaya_kirim : 0,
          rekening_bayar: (formData.show_uang_muka && formData.rekening) ? formData.rekening : null,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Data berhasil diupdate! Uang muka, biaya kirim, history cicilan, dan saldo kas telah diperbarui.');
        onSuccess(json?.pembelian);
        onClose();
      } else {
        alert('Gagal update: ' + json.error);
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
              <p className="text-lg font-semibold text-gray-800">Memperbarui Uang Muka dan Ongkir...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">EDIT UANG MUKA DAN ONGKIR</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Info Current Values */}
            <div className="p-3 bg-gray-50 rounded border">
              <p className="text-sm font-medium text-gray-700 mb-2">Nilai Saat Ini:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Hutang:</span>
                  <span className="font-semibold text-red-600">
                    Rp. {safeTotalHutang.toLocaleString('id-ID')}
                  </span>
                </div>
                {formData.show_biaya_kirim && estimatedTotalHutang !== safeTotalHutang && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Hutang (Baru):</span>
                    <span className="font-semibold text-blue-600">
                      Rp. {estimatedTotalHutang.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Uang Muka:</span>
                  <span className="font-semibold">Rp. {currentData.uang_muka.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sisa Tagihan:</span>
                  <span className="font-semibold text-orange-600">Rp. {safeSisaTagihan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Biaya Kirim:</span>
                  <span className="font-semibold">Rp. {currentData.biaya_kirim.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rekening:</span>
                  <span className="font-semibold">{currentData.rekening_bayar || '-'}</span>
                </div>
              </div>
            </div>

            {/* Checkbox Biaya Kirim */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="biaya_kirim"
                checked={formData.show_biaya_kirim}
                onChange={(e) =>
                  setFormData({ ...formData, show_biaya_kirim: e.target.checked })
                }
                className="mr-2 w-4 h-4"
              />
              <label htmlFor="biaya_kirim" className="font-medium">
                Edit Biaya Kirim
              </label>
            </div>

            {/* Biaya Kirim Input */}
            {formData.show_biaya_kirim && (
              <div>
                <label className="block mb-2 font-medium">Biaya Kirim Baru</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.biaya_kirim || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, biaya_kirim: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Masukkan biaya kirim"
                  min="0"
                />
              </div>
            )}

            {/* Checkbox Uang Muka */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="uang_muka"
                checked={formData.show_uang_muka}
                onChange={(e) =>
                  setFormData({ ...formData, show_uang_muka: e.target.checked })
                }
                className="mr-2 w-4 h-4"
              />
              <label htmlFor="uang_muka" className="font-medium">
                Edit Uang Muka & Rekening
              </label>
            </div>

            {/* Uang Muka & Rekening Inputs */}
            {formData.show_uang_muka && (
              <>
                <div>
                  <label className="block mb-2 font-medium">Uang Muka Baru</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.uang_muka || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, uang_muka: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Masukkan uang muka"
                    min="0"
                  />
                  {selisihUangMuka > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Penambahan: Rp. {selisihUangMuka.toLocaleString('id-ID')}
                    </p>
                  )}
                  {formData.uang_muka < currentData.uang_muka && (
                    <p className="text-xs text-orange-600 mt-1">
                      Pengurangan: Rp. {(currentData.uang_muka - formData.uang_muka).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 font-medium">
                    Rekening {formData.uang_muka > 0 && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={formData.rekening}
                    onChange={handleRekeningChange}
                    className="w-full px-3 py-2 border rounded"
                    required={formData.uang_muka > 0}
                  >
                    <option value="">Pilih Rekening ({rekenings.length} tersedia)</option>
                    {rekenings.map((rek) => (
                      <option key={rek.id} value={rek.nama_kas}>
                        {rek.nama_kas} {rek.no_rekening ? `/ ${rek.no_rekening}` : ''} 
                        (Saldo: Rp. {rek.saldo.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                  {rekenings.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Tidak ada rekening tersedia
                    </p>
                  )}
                  {selectedKas && selisihUangMuka > 0 && (
                    <div className={`mt-2 p-2 rounded ${
                      selisihUangMuka > selectedKas.saldo 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-green-50 border border-green-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        selisihUangMuka > selectedKas.saldo 
                          ? 'text-red-800' 
                          : 'text-green-800'
                      }`}>
                        Saldo tersedia: Rp. {selectedKas.saldo.toLocaleString('id-ID')}
                      </p>
                      {selisihUangMuka > selectedKas.saldo && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Saldo tidak cukup untuk penambahan Rp. {selisihUangMuka.toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Summary Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm font-medium text-blue-800 mb-2">Ringkasan Perubahan:</p>
            <div className="space-y-1 text-sm">
              {formData.show_biaya_kirim && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Biaya Kirim:</span>
                  <span className="font-semibold">
                    Rp. {currentData.biaya_kirim.toLocaleString('id-ID')} → 
                    Rp. {formData.biaya_kirim.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              {formData.show_uang_muka && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Uang Muka:</span>
                    <span className="font-semibold">
                      Rp. {currentData.uang_muka.toLocaleString('id-ID')} → 
                      Rp. {formData.uang_muka.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Sisa Tagihan Baru:</span>
                    <span className="font-bold text-blue-600">
                      Rp. {remainingAfterUangMuka.toLocaleString('id-ID')}
                    </span>
                  </div>
                </>
              )}
            </div>
            {isUangMukaOverTotal && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ Uang muka tidak boleh melebihi total hutang (Rp. {maxUangMuka.toLocaleString('id-ID')})
              </p>
            )}
          </div>

          {/* Warning Notice */}
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs text-yellow-800">
              ⚠️ Perhatian: Perubahan ini akan mempengaruhi history cicilan dan saldo kas secara otomatis
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              type="submit"
              disabled={
                loading || 
                (formData.show_uang_muka && selisihUangMuka > 0 && selectedKas && selisihUangMuka > selectedKas.saldo) || 
                (maxUangMuka > 0 && isUangMukaOverTotal)
              }
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
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
