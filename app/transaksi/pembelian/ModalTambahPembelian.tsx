'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculatePembelianTotals } from '@/lib/transaksi/calculatePembelianTotals';

interface Suplier {
  id: number;
  nama: string;
  cabang_id: number;
}

interface Cabang {
  id: number;
  nama_cabang: string;
  kode_cabang: string;
}

interface Kas {
  id: number;
  nama_kas: string;
  mulai_saldo: number;
  cabang_id: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pembelianId: number) => void;
  isTransitioning?: boolean;
}

interface FormDataPembelian {
  tanggal: string;
  suplier_id: string | number;
  cabang_id: string | number;
  jenis_pembayaran: string;
  show_biaya_kirim: boolean;
  biaya_kirim: string | number;
  show_uang_muka: boolean;
  uang_muka: string | number;
  kas_id: string | number; // ✅ Added for down payment account selection
}


export default function ModalTambahPembelian({ isOpen, onClose, onSuccess, isTransitioning = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [supliers, setSupliers] = useState<Suplier[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [allKasOptions, setAllKasOptions] = useState<Kas[]>([]); // All kas accounts
  const [filteredKasOptions, setFilteredKasOptions] = useState<Kas[]>([]); // Filtered by cabang
  const [filteredCabangs, setFilteredCabangs] = useState<Cabang[]>([]);

  const [formData, setFormData] = useState<FormDataPembelian>({
    tanggal: new Date().toISOString().split('T')[0],
    suplier_id: '',
    cabang_id: '',
    jenis_pembayaran: 'cash',
    show_biaya_kirim: false,
    biaya_kirim: '',
    show_uang_muka: false,
    uang_muka: '',
    kas_id: '', // ✅ Added kas_id initialization
  });

  // Preview calculated totals based on current form (no detail_pembelian yet)
  const previewForTotals: any = {
    tanggal: formData.tanggal,
    biaya_kirim: Number(formData.show_biaya_kirim ? formData.biaya_kirim : 0) || 0,
    uang_muka: Number(formData.show_uang_muka ? formData.uang_muka : 0) || 0,
    detail_pembelian: [],
  };

  const { subtotal: previewSubtotal, finalTotal: previewFinalTotal, tagihan: previewTagihan } =
    calculatePembelianTotals(previewForTotals);

  // ❌ REMOVED: uangMukaExceeds check - this was buggy validation
  // Because total is calculated without items at this stage, validation is premature
  // Down payment validation should happen AFTER items are added


  // Load supliers dan cabangs dan kas
  useEffect(() => {
    if (isOpen) {
      fetchSupliers();
      fetchCabangs();
      fetchKas(); // ✅ Added kas fetching
    }
  }, [isOpen]);

  // Filter cabang berdasarkan suplier
  useEffect(() => {
    if (formData.suplier_id) {
      const suplierId = typeof formData.suplier_id === 'string' ? parseInt(formData.suplier_id, 10) : formData.suplier_id;
      const selectedSuplier = supliers.find(s => s.id === suplierId);
      if (selectedSuplier) {
        const filtered = cabangs.filter(c => c.id === selectedSuplier.cabang_id);
        setFilteredCabangs(filtered);
        // Auto-select cabang jika hanya ada 1
        if (filtered.length === 1) {
          setFormData(prev => ({ ...prev, cabang_id: filtered[0].id.toString() }));
        }
      }
    } else {
      setFilteredCabangs([]);
      setFormData(prev => ({ ...prev, cabang_id: '' }));
    }
  }, [formData.suplier_id, supliers, cabangs]);

  // Filter kas berdasarkan cabang yang dipilih
  useEffect(() => {
    if (formData.cabang_id) {
      const cabangId = typeof formData.cabang_id === 'string' ? parseInt(formData.cabang_id, 10) : formData.cabang_id;
      const filteredKas = allKasOptions.filter(kas => kas.cabang_id === cabangId);
      setFilteredKasOptions(filteredKas);
    } else {
      setFilteredKasOptions([]);
      setFormData(prev => ({ ...prev, kas_id: '' }));
    }
  }, [formData.cabang_id, allKasOptions]);

  const fetchSupliers = async () => {
    try {
      const res = await fetch('/api/master/suplier');
      const json = await res.json();
      setSupliers(json.data || []);
    } catch (error) {
      console.error('Error fetching supliers:', error);
    }
  };

  const fetchCabangs = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangs(json.data || []);
    } catch (error) {
      console.error('Error fetching cabangs:', error);
    }
  };

  const fetchKas = async () => {
    try {
      const res = await fetch('/api/master/kas');
      const json = await res.json();
      setAllKasOptions(json.data || []);
    } catch (error) {
      console.error('Error fetching kas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/transaksi/pembelian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          suplier_id: typeof formData.suplier_id === 'string' ? parseInt(formData.suplier_id, 10) : formData.suplier_id,
          cabang_id: typeof formData.cabang_id === 'string' ? parseInt(formData.cabang_id, 10) : formData.cabang_id,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        handleClose();
        alert('Data berhasil disimpan');
        // Tunggu sebentar sebelum redirect
        setTimeout(() => {
          onSuccess(json.data.id);
        }, 500);
      } else {
        alert(json.error || 'Gagal menyimpan data');
      }
    } catch (error) {
      alert('Terjadi kesalahan');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
  setFormData({
    tanggal: new Date().toISOString().split('T')[0],
    suplier_id: '',
    cabang_id: '',
    jenis_pembayaran: 'cash',
    show_biaya_kirim: false,
    biaya_kirim: '',
    show_uang_muka: false,
    uang_muka: '',
    kas_id: '', // ✅ Added kas_id reset
  });
  onClose();
};

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="sticky top-0 bg-yellow-100 px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">TAMBAH PEMBELIAN BARANG</h2>
          <button onClick={handleClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tgl Pembelian */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Tgl Pembelian</label>
            <input
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
              className="col-span-2 px-3 py-2 border rounded"
              required
            />
          </div>

          {/* Nota Supplier */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Nota Supplier</label>
            <input
              type="text"
              value="Auto Generate"
              disabled
              className="col-span-2 px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Nama Supplier */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Nama Supplier</label>
            <select
              value={formData.suplier_id}
              onChange={(e) => setFormData({ ...formData, suplier_id: e.target.value })}
              className="col-span-2 px-3 py-2 border rounded"
              required
            >
              <option value="">Pilih Supplier</option>
              {supliers.map((s) => (
                <option key={s.id} value={s.id.toString()}>{s.nama}</option>
              ))}
            </select>
          </div>

          {/* Kantor */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Kantor</label>
            <select
              value={formData.cabang_id}
              onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
              className="col-span-2 px-3 py-2 border rounded"
              disabled={!formData.suplier_id}
              required
            >
              <option value="">Pilih Kantor</option>
              {filteredCabangs.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.kode_cabang} - {c.nama_cabang}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox Biaya Kirim */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">
              <input
                type="checkbox"
                checked={formData.show_biaya_kirim}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  show_biaya_kirim: e.target.checked,
                  biaya_kirim: e.target.checked ? formData.biaya_kirim : 0
                })}
                className="mr-2"
              />
              Tampilkan Biaya Kirim
            </label>
            {formData.show_biaya_kirim && (
              <input
                type="number"
                value={formData.biaya_kirim}
                onChange={(e) => setFormData({ ...formData, biaya_kirim: parseFloat(e.target.value) || 0 })}
                className="col-span-2 px-3 py-2 border rounded"
                placeholder="Biaya Kirim"
              />
            )}
          </div>

          {/* Checkbox Uang Muka */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">
              <input
                type="checkbox"
                checked={formData.show_uang_muka}
                onChange={(e) => setFormData({
                  ...formData,
                  show_uang_muka: e.target.checked,
                  uang_muka: e.target.checked ? formData.uang_muka : 0
                })}
                className="mr-2"
              />
              Tampilkan Uang Muka
            </label>
            {formData.show_uang_muka && (
              <>
                <input
                  type="number"
                  value={formData.uang_muka}
                  onChange={(e) => setFormData({ ...formData, uang_muka: parseFloat(e.target.value) || 0 })}
                  className="col-span-2 px-3 py-2 border rounded"
                  placeholder="Uang Muka"
                />
                <div className="col-start-2 col-span-2">
                  <p className="text-xs text-gray-500 mt-1">
                    Uang muka akan mengurangi tagihan. Sisa tagihan (preview): Rp. {Math.max(0, previewFinalTotal - Number(formData.uang_muka || 0)).toLocaleString('id-ID')}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Kas Account Selection - Only show when uang muka is enabled */}
          {formData.show_uang_muka && (
            <div className="grid grid-cols-3 items-center gap-4">
              <label className="font-medium">Kas Sumber <span className="text-red-500">*</span></label>
              <select
                value={formData.kas_id}
                onChange={(e) => setFormData({ ...formData, kas_id: e.target.value })}
                className="col-span-2 px-3 py-2 border rounded"
                required={formData.show_uang_muka}
              >
                <option value="">Pilih Kas Sumber Uang Muka</option>
                {filteredKasOptions.map((kas: Kas) => (
                  <option key={kas.id} value={kas.id.toString()}>
                    {kas.nama_kas}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Jenis Pembayaran */}
          <div className="grid grid-cols-3 items-center gap-4">
            <label className="font-medium">Jenis Pembayaran</label>
            <select
              value={formData.jenis_pembayaran}
              onChange={(e) => setFormData({ ...formData, jenis_pembayaran: e.target.value as 'cash' | 'transfer' })}
              className="col-span-2 px-3 py-2 border rounded"
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
            </select>
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
              onClick={handleClose}
              className="px-8 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Batal
            </button>
          </div>
        </form>

        {/* Loading Overlay during transition */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 font-medium">Menuju ke Detail Pembelian...</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
