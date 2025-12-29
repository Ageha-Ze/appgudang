'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import SingleOverlay from '../../../../components/SingleOverlay';

interface Customer {
  id: number;
  nama: string;
  kode_customer: string;
}

interface Pegawai {
  id: number;
  nama: string;
  jabatan: string;
  cabang_id: number;
}

interface Penjualan {
  id: number;
  tanggal: string;
  customer_id: number;
  pegawai_id: number;
  jenis_pembayaran: string;
  nota_penjualan?: string;
  customer?: {
    nama: string;
  };
  pegawai?: {
    nama: string;
    cabang?: {
      id: number;
      nama_cabang: string;
    };
  };
}

interface CicilanItem {
  id: number;
  jumlah_cicilan: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  penjualan: Penjualan;
}

export default function ModalEditDataPenjualan({
  isOpen,
  onClose,
  onSuccess,
  penjualan,
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pegawais, setPegawais] = useState<Pegawai[]>([]);
  const [cicilans, setCicilans] = useState<CicilanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tanggal: '',
    customer_id: 0,
    pegawai_id: 0,
    jenis_pembayaran: '',
  });

  useEffect(() => {
    if (isOpen && penjualan) {
      fetchCustomers();
      fetchPegawais();
      fetchCicilans();
      
      setFormData({
        tanggal: penjualan.tanggal.split('T')[0],
        customer_id: penjualan.customer_id,
        pegawai_id: penjualan.pegawai_id,
        jenis_pembayaran: penjualan.jenis_pembayaran,
      });
    }
  }, [isOpen, penjualan]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/master/customer');
      const json = await res.json();
      if (json.data) {
        setCustomers(json.data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchPegawais = async () => {
    try {
      const cabangId = penjualan.pegawai?.cabang?.id;
      const url = cabangId 
        ? `/api/master/pegawai?cabang_id=${cabangId}`
        : '/api/master/pegawai';
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.data) {
        const salesOnly = json.data.filter((p: Pegawai) => 
          p.jabatan.toLowerCase().includes('sales')
        );
        setPegawais(salesOnly);
      }
    } catch (error) {
      console.error('Error fetching pegawais:', error);
    }
  };

  const fetchCicilans = async () => {
    try {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      alert('Pilih customer terlebih dahulu');
      return;
    }

    if (!formData.pegawai_id) {
      alert('Pilih sales terlebih dahulu');
      return;
    }

    // ⚠️ WARNING: Cek jika customer berubah dan ada cicilan
    const customerBerubah = formData.customer_id !== penjualan.customer_id;
    const totalCicilan = calculateTotalCicilan();
    const adaCicilan = totalCicilan > 0;

    if (customerBerubah && adaCicilan) {
      const konfirmasi = confirm(
        `⚠️ PERHATIAN!\n\n` +
        `Anda akan mengganti customer dari "${penjualan.customer?.nama}" ke customer lain.\n\n` +
        `Terdapat ${cicilans.length} cicilan dengan total Rp. ${totalCicilan.toLocaleString('id-ID')} yang sudah dibayar.\n\n` +
        `KONSEKUENSI:\n` +
        `1. Semua cicilan akan DIHAPUS\n` +
        `2. Kas akan DIKEMBALIKAN\n` +
        `3. Sisa tagihan akan DIRESET ke nilai awal\n` +
        `4. Customer baru akan mulai dari tagihan penuh\n\n` +
        `Apakah Anda yakin ingin melanjutkan?`
      );

      if (!konfirmasi) {
        return;
      }

      // Konfirmasi kedua untuk keamanan
      const konfirmasiKedua = confirm(
        `Konfirmasi terakhir!\n\n` +
        `Cicilan sebesar Rp. ${totalCicilan.toLocaleString('id-ID')} akan dihapus dan kas dikembalikan.\n\n` +
        `Ketik "YA" di prompt berikutnya untuk melanjutkan.`
      );

      if (!konfirmasiKedua) {
        return;
      }

      const inputKonfirmasi = prompt('Ketik "YA" (huruf besar semua) untuk melanjutkan:');
      if (inputKonfirmasi !== 'YA') {
        alert('Operasi dibatalkan');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/transaksi/penjualan/${penjualan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reset_cicilan: customerBerubah && adaCicilan, // Flag untuk backend
        }),
      });

      const json = await res.json();

      if (res.ok) {
        if (customerBerubah && adaCicilan) {
          alert(
            `Data penjualan berhasil diupdate!\n\n` +
            `✅ Customer berhasil diganti\n` +
            `✅ ${cicilans.length} cicilan telah dihapus\n` +
            `✅ Kas sebesar Rp. ${totalCicilan.toLocaleString('id-ID')} telah dikembalikan\n` +
            `✅ Tagihan direset ke nilai awal`
          );
        } else {
          alert('Data penjualan berhasil diupdate');
        }
        onSuccess();
        onClose();
      } else {
        alert(json.error || 'Gagal mengupdate data');
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

  const customerAkanBerubah = formData.customer_id !== penjualan.customer_id;
  const totalCicilan = calculateTotalCicilan();
  const adaCicilan = totalCicilan > 0;
  const showWarning = customerAkanBerubah && adaCicilan;

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan Data...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Penjualan Barang</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Warning jika customer akan berubah dan ada cicilan */}
        {showWarning && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm">
                <p className="font-bold text-red-800 mb-1">⚠️ PERHATIAN!</p>
                <p className="text-red-700 mb-2">
                  Mengganti customer akan menghapus {cicilans.length} cicilan 
                  (Rp. {totalCicilan.toLocaleString('id-ID')}) dan mengembalikan kas.
                </p>
                <p className="text-red-600 text-xs">
                  Tagihan akan direset ke nilai awal untuk customer baru.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Jual <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.tanggal}
              onChange={(e) =>
                setFormData({ ...formData, tanggal: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nota Jual
            </label>
            <input
              type="text"
              value={penjualan.nota_penjualan || '-'}
              className="w-full px-3 py-2 border rounded bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.customer_id}
              onChange={(e) =>
                setFormData({ ...formData, customer_id: parseInt(e.target.value) })
              }
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                customerAkanBerubah && adaCicilan ? 'border-red-500 bg-red-50' : ''
              }`}
              required
            >
              <option value="">-- Pilih Customer --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.nama}
                </option>
              ))}
            </select>
            {customerAkanBerubah && adaCicilan && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Mengganti customer akan menghapus semua cicilan!
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nama Sales <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.pegawai_id}
              onChange={(e) =>
                setFormData({ ...formData, pegawai_id: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Pilih Sales --</option>
              {pegawais.map((pegawai) => (
                <option key={pegawai.id} value={pegawai.id}>
                  {pegawai.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Gudang
            </label>
            <input
              type="text"
              value={penjualan.pegawai?.cabang?.nama_cabang || '-'}
              className="w-full px-3 py-2 border rounded bg-gray-100"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Jenis Pembayaran <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.jenis_pembayaran}
              onChange={(e) =>
                setFormData({ ...formData, jenis_pembayaran: e.target.value })
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Pilih Jenis Pembayaran --</option>
              <option value="tunai">Tunai</option>
              <option value="hutang">Hutang</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : showWarning ? 'Simpan & Reset Cicilan' : 'Simpan'}
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
