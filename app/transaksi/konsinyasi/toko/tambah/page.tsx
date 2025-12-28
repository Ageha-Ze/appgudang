'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Save, X } from 'lucide-react';
import SingleOverlay from '../../../../../components/SingleOverlay';

interface Cabang {
  id: number;
  nama_cabang: string;
}

export default function TambahTokoPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    kode_toko: '',
    nama_toko: '',
    pemilik: '',
    alamat: '',
    no_telp: '',
    email: '',
    cabang_id: '',
    status: 'Aktif',
    tanggal_kerjasama: '',
    keterangan: '',
  });
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCabang();
  }, []);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.kode_toko || !formData.nama_toko) {
      alert('Kode Toko dan Nama Toko wajib diisi');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/transaksi/konsinyasi/toko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cabang_id: formData.cabang_id ? parseInt(formData.cabang_id) : null,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert('Toko konsinyasi berhasil ditambahkan');
        router.push('/transaksi/konsinyasi?tab=toko');
      } else {
        alert(json.error || 'Gagal menambahkan toko');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SingleOverlay>
      {loading ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan Toko...</p>
              <p className="text-sm text-gray-600">Mohon tunggu sebentar</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
        <div className="bg-indigo-500 p-3 rounded-lg">
          <Store className="text-white" size={24} />
        </div>
        <div>
          <p className="text-sm text-indigo-600">Master Toko</p>
          <h1 className="text-2xl font-bold text-indigo-700">Tambah Toko Konsinyasi</h1>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kode Toko */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Kode Toko <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.kode_toko}
                onChange={(e) => setFormData({ ...formData, kode_toko: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: TK001"
                required
              />
            </div>

            {/* Nama Toko */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nama Toko <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nama_toko}
                onChange={(e) => setFormData({ ...formData, nama_toko: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: Toko Sumber Rejeki"
                required
              />
            </div>

            {/* Pemilik */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Pemilik Toko</label>
              <input
                type="text"
                value={formData.pemilik}
                onChange={(e) => setFormData({ ...formData, pemilik: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nama pemilik toko"
              />
            </div>

            {/* No Telp */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">No Telepon</label>
              <input
                type="text"
                value={formData.no_telp}
                onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="08xx xxxx xxxx"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="email@example.com"
              />
            </div>

            {/* Cabang */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Cabang</label>
              <select
                value={formData.cabang_id}
                onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

            {/* Tanggal Kerjasama */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Tanggal Kerjasama</label>
              <input
                type="date"
                value={formData.tanggal_kerjasama}
                onChange={(e) => setFormData({ ...formData, tanggal_kerjasama: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Alamat</label>
            <textarea
              value={formData.alamat}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Alamat lengkap toko"
            />
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Keterangan</label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Catatan tambahan"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              <Save size={20} />
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition whitespace-nowrap"
            >
              <X size={20} />
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
