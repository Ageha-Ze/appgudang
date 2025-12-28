'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ModalTambahPenjualanProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Pegawai {
  id: number;
  nama: string;
  jabatan: string;
  cabang_id: number;
  cabang?: {
    id: number;
    nama_cabang: string;
  };
}

interface Customer {
  id: number;
  nama: string;
  kode_customer: string;
}

export default function ModalTambahPenjualan({
  isOpen,
  onClose,
  onSuccess,
}: ModalTambahPenjualanProps) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    pegawai_id: 0,
    customer_id: 0,
    customer_nama_manual: '', // ✅ Tambah ini
    jenis_pembayaran: 'tunai',
    keterangan: '',
  });
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [useDropdown, setUseDropdown] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchPegawai();
      fetchCustomer();
    }
  }, [isOpen]);

  const fetchPegawai = async () => {
    try {
      setLoadingData(true);
      const res = await fetch('/api/master/pegawai?jabatan=sales');
      const json = await res.json();
      setPegawaiList(json.data || []);
    } catch (error) {
      console.error('Error fetching pegawai:', error);
      setPegawaiList([]);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchCustomer = async () => {
    try {
      const res = await fetch('/api/master/customer');
      const json = await res.json();
      setCustomerList(json.data || []);
    } catch (error) {
      console.error('Error fetching customer:', error);
      setCustomerList([]);
    }
  };

  const handlePegawaiChange = (pegawaiId: number) => {
    const pegawai = pegawaiList.find((p) => p.id === pegawaiId);
    setSelectedPegawai(pegawai || null);
    setFormData({ ...formData, pegawai_id: pegawaiId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // ✅ PREVENT DOUBLE-SUBMIT (FIX #1)
  if (loading) {
    console.log('⚠️ Submit already in progress, ignoring...');
    return;
  }

  if (formData.pegawai_id === 0) {
    alert('Pilih sales terlebih dahulu');
    return;
  }

  // ✅ Validasi customer: bisa dropdown atau manual
  if (useDropdown && formData.customer_id === 0) {
    alert('Pilih customer terlebih dahulu');
    return;
  }

  if (!useDropdown && !formData.customer_nama_manual.trim()) {
    alert('Masukkan nama customer');
    return;
  }

  try {
    setLoading(true);

    // ✅ Jika input manual, create customer dulu
    let customerId = formData.customer_id;

    if (!useDropdown && formData.customer_nama_manual) {
      // Generate kode customer otomatis
      const kodeCustomer = `CUST-${Date.now()}`;

      const resCustomer = await fetch('/api/master/customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kode_customer: kodeCustomer,
          nama: formData.customer_nama_manual,
          cabang_id: selectedPegawai?.cabang_id || null,
        }),
      });

      if (!resCustomer.ok) {
        throw new Error('Gagal membuat customer baru');
      }

      const jsonCustomer = await resCustomer.json();
      customerId = jsonCustomer.data.id;
    }

    // Create penjualan
    const res = await fetch('/api/transaksi/penjualan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        customer_id: customerId,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      alert('Penjualan berhasil dibuat');

      // Redirect ke halaman detail
      window.location.href = `/transaksi/penjualan/${json.data.id}`;

      onSuccess();
      onClose();
    } else {
      const error = await res.json();
      alert(error.error || 'Gagal membuat penjualan');
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan Penjualan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-yellow-50 rounded-lg p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">TAMBAH PENJUALAN BARANG</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        {loadingData && (
          <div className="flex items-center justify-center py-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mr-3"></div>
            <span className="text-blue-700 font-medium">Memuat data...</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* No Penjualan */}
          <div>
            <label className="block text-sm font-medium mb-1">No. Penjualan</label>
            <input
              type="text"
              value="Auto Generate"
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium mb-1">Tgl Penjualan</label>
            <input
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          {/* Nama Sales */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Sales ({pegawaiList.length} tersedia)
            </label>
            <select
              value={formData.pegawai_id}
              onChange={(e) => handlePegawaiChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded"
              required
            >
              <option value={0}>Pilih Sales</option>
              {pegawaiList.map((pegawai) => (
                <option key={pegawai.id} value={pegawai.id}>
                  {pegawai.nama} - {pegawai.jabatan}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Keluar (Cabang) */}
          <div>
            <label className="block text-sm font-medium mb-1">Stock Keluar</label>
            <input
              type="text"
              value={selectedPegawai?.cabang?.nama_cabang || '-'}
              disabled
              className="w-full px-3 py-2 border rounded bg-gray-100"
            />
          </div>

          {/* Pelanggan Checkbox & Dropdown/Manual */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="pilihPelanggan"
                checked={useDropdown}
                onChange={(e) => {
                  setUseDropdown(e.target.checked);
                  if (e.target.checked) {
                    setFormData({ ...formData, customer_nama_manual: '' });
                  } else {
                    setFormData({ ...formData, customer_id: 0 });
                  }
                }}
              />
              <label htmlFor="pilihPelanggan" className="text-sm font-medium">
                Pilih melalui Dropdown
              </label>
            </div>

            {/* Dropdown Customer */}
            {useDropdown && (
              <select
                value={formData.customer_id}
                onChange={(e) =>
                  setFormData({ ...formData, customer_id: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded"
                required={useDropdown}
              >
                <option value={0}>-- Pilih Customer --</option>
                {customerList.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.nama} ({customer.kode_customer})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Input Manual Customer */}
          {!useDropdown && (
            <div>
              <label className="block text-sm font-medium mb-1">Nama customer</label>
              <input
                type="text"
                value={formData.customer_nama_manual}
                onChange={(e) =>
                  setFormData({ ...formData, customer_nama_manual: e.target.value })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="Ketik nama customer baru..."
                required={!useDropdown}
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end mt-6">
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              )}
              {loading ? 'Membuat...' : 'Detail'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
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
