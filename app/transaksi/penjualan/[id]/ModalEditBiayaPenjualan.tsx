"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import SingleOverlay from '../../../../components/SingleOverlay';
import { Penjualan as PenjualanType } from "@/types/transaksi";
import { calculatePenjualanTotals } from '@/lib/transaksi/calculateTotals';

interface Kas {
  id: number;
  nama_kas: string;
  no_rekening?: string;
  saldo: number;
  cabang_id?: number;
}

interface CicilanItem {
  id: number;
  jumlah_cicilan: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  penjualan: PenjualanType | null;
}

export default function ModalEditBiayaPenjualan({
  isOpen,
  onClose,
  onSuccess,
  penjualan,
}: Props) {
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [cicilans, setCicilans] = useState<CicilanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    biaya_ongkir: 0,
    biaya_potong: 0,
    nilai_diskon: 0,
    tampilkan_biaya_lain: false,
    tampilkan_uang_muka: false,
    uang_muka: 0,
    kas_id: 0,
    tanggal_transaksi: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isOpen && penjualan) {
      fetchKas();
      fetchCicilans();

      setFormData((prev) => ({
        ...prev,
        biaya_ongkir: penjualan.biaya_ongkir ?? 0,
        biaya_potong: penjualan.biaya_potong ?? 0,
        nilai_diskon: penjualan.nilai_diskon ?? 0,
        tampilkan_biaya_lain: false,
        tampilkan_uang_muka: false,
        uang_muka: 0,
        kas_id: 0,
        tanggal_transaksi: new Date().toISOString().split('T')[0],
      }));
    }
  }, [isOpen, penjualan]);

  const fetchKas = async () => {
    try {
      if (!penjualan) return;
      const cabangId = penjualan.pegawai?.cabang_id;
      const res = await fetch('/api/master/kas');
      const json = await res.json();
      const allKas = json.data || [];
      const filtered = cabangId ? allKas.filter((k: any) => k.cabang_id === cabangId) : allKas;
      setKasList(filtered);
    } catch (error) {
      console.error('Error fetching kas:', error);
      setKasList([]);
    }
  };

  const fetchCicilans = async () => {
    try {
      if (!penjualan) return;
      const res = await fetch(`/api/transaksi/penjualan/${penjualan.id}/cicilan`);
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

  const calculateSubTotal = () => {
    if (!penjualan) return 0;
    return calculatePenjualanTotals(penjualan).subtotal;
  };

  const calculateFinalTotal = () => {
    if (!penjualan) return 0;
    const preview = {
      ...penjualan,
      biaya_ongkir: formData.biaya_ongkir,
      biaya_potong: formData.biaya_potong,
      nilai_diskon: formData.nilai_diskon,
      uang_muka: formData.tampilkan_uang_muka ? formData.uang_muka : penjualan.uang_muka ?? 0,
    } as any;

    const { finalTotal } = calculatePenjualanTotals(preview);
    return finalTotal;
  };

  const calculateSisaTagihan = () => {
    if (!penjualan) return 0;
    
    const totalCicilan = calculateTotalCicilan();
    const uangMukaValue = formData.tampilkan_uang_muka ? formData.uang_muka : (penjualan.uang_muka ?? 0);
    
    const preview = {
      ...penjualan,
      biaya_ongkir: formData.biaya_ongkir,
      biaya_potong: formData.biaya_potong,
      nilai_diskon: formData.nilai_diskon,
      uang_muka: uangMukaValue,
    } as any;

    const { tagihan } = calculatePenjualanTotals(preview, { totalCicilan });
    return tagihan;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi uang muka
    if (formData.tampilkan_uang_muka && formData.uang_muka > 0) {
      if (!formData.kas_id) {
        alert('Pilih rekening untuk uang muka');
        return;
      }
    }

    setLoading(true);

    try {
      const updateData: any = {
        biaya_ongkir: formData.biaya_ongkir,
        biaya_potong: formData.biaya_potong,
        nilai_diskon: formData.nilai_diskon,
      };

      // Jika ada uang muka, kirim juga data uang muka
      if (formData.tampilkan_uang_muka && formData.uang_muka > 0) {
        updateData.uang_muka = formData.uang_muka;
        updateData.kas_id = formData.kas_id;
      }

      if (!penjualan) return;
      const res = await fetch(`/api/transaksi/penjualan/${penjualan.id}/biaya`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Biaya berhasil diupdate');
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Gagal mengupdate biaya');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Terjadi kesalahan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
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
              <p className="text-lg font-semibold text-gray-800">Menyimpan Biaya...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Biaya Penjualan</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sub Total Produk</label>
            <input
              type="text"
              value={`Rp. ${calculateSubTotal().toLocaleString('id-ID')}`}
              className="w-full px-3 py-2 border rounded bg-gray-100"
              disabled
            />
          </div>

          {/* Checkbox Biaya Lainnya */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="biaya_lainnya"
              checked={formData.tampilkan_biaya_lain}
              onChange={(e) =>
                setFormData({ ...formData, tampilkan_biaya_lain: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="biaya_lainnya" className="ml-2 text-sm font-medium">
              Tampilkan Biaya Lain
            </label>
          </div>

          {/* Fields yang muncul setelah checkbox */}
          {formData.tampilkan_biaya_lain && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Biaya Kirim</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.biaya_ongkir || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, biaya_ongkir: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Biaya Kemas</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.biaya_potong || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, biaya_potong: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nilai Diskon</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.nilai_diskon || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, nilai_diskon: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </>
          )}

          {/* Checkbox Uang Muka */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="uang_muka"
              checked={formData.tampilkan_uang_muka}
              onChange={(e) =>
                setFormData({ ...formData, tampilkan_uang_muka: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="uang_muka" className="ml-2 text-sm font-medium">
              Tampilkan Uang Muka
            </label>
          </div>

          {/* Fields Uang Muka */}
          {formData.tampilkan_uang_muka && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Uang Muka <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.uang_muka || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, uang_muka: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  required={formData.tampilkan_uang_muka}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Rekening <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.kas_id}
                  onChange={(e) =>
                    setFormData({ ...formData, kas_id: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={formData.tampilkan_uang_muka}
                >
                  <option value="">-- Pilih Rekening --</option>
                  {kasList.map((kas) => (
                    <option key={kas.id} value={kas.id}>
                      {kas.nama_kas} {kas.no_rekening ? `(${kas.no_rekening})` : ''} - Rp. {kas.saldo.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                {kasList.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Tidak ada rekening tersedia untuk cabang ini
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Tanggal Transaksi Terakhir</label>
            <input
              type="date"
              value={formData.tanggal_transaksi}
              onChange={(e) =>
                setFormData({ ...formData, tanggal_transaksi: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Final Total</label>
            <input
              type="text"
              value={`Rp. ${calculateFinalTotal().toLocaleString('id-ID')}`}
              className="w-full px-3 py-2 border rounded bg-gray-100 font-bold"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sisa Tagihan</label>
            <input
              type="text"
              value={`Rp. ${calculateSisaTagihan().toLocaleString('id-ID')}`}
              className="w-full px-3 py-2 border rounded bg-red-100 font-bold"
              disabled
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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

