'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { CabangData } from '@/types/cabang';
import { addCabang, updateCabang } from './actions';

interface CabangModalProps {
  isOpen: boolean;
  onClose: () => void;
  cabang: CabangData | null;
  onSuccess: () => void;
}

export default function CabangModal({ isOpen, onClose, cabang, onSuccess }: CabangModalProps) {
  const [formData, setFormData] = useState({
    jenis_kantor: '',
    kode_cabang: '',
    nama_cabang: '',
    no_telp: '',
    alamat: '',
    email: '',
    nama_kc: '',
    jumlah_pegawai: '',
    tanggal_operasi: '',
    link_google_map: '',
    nama_kas: '',
    nomor_rekening: '',
    kapasitas_box: '',
    kapasitas_kg: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cabang) {
      setFormData({
        jenis_kantor: cabang.jenis_kantor,
        kode_cabang: cabang.kode_cabang,
        nama_cabang: cabang.nama_cabang,
        no_telp: cabang.no_telp,
        alamat: cabang.alamat,
        email: cabang.email,
        nama_kc: cabang.nama_kc,
        jumlah_pegawai: cabang.jumlah_pegawai.toString(),
        tanggal_operasi: cabang.tanggal_operasi,
        link_google_map: cabang.link_google_map,
        nama_kas: cabang.nama_kas,
        nomor_rekening: cabang.nomor_rekening,
        kapasitas_box: cabang.kapasitas_box.toString(),
        kapasitas_kg: cabang.kapasitas_kg.toString(),
      });
    } else {
      setFormData({
        jenis_kantor: '',
        kode_cabang: '',
        nama_cabang: '',
        no_telp: '',
        alamat: '',
        email: '',
        nama_kc: '',
        jumlah_pegawai: '',
        tanggal_operasi: '',
        link_google_map: '',
        nama_kas: '',
        nomor_rekening: '',
        kapasitas_box: '',
        kapasitas_kg: '',
      });
    }
    setError(null);
  }, [cabang, isOpen]);

  const handleSubmit = async () => {
    // Validasi
    if (!formData.nama_cabang || !formData.jenis_kantor) {
      setError('Nama Cabang dan Jenis Kantor harus diisi');
      return;
    }

    if (!formData.nama_kas) {
      setError('Nama Kas harus diisi untuk generate kas otomatis');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        jenis_kantor: formData.jenis_kantor,
        kode_cabang: formData.kode_cabang,
        nama_cabang: formData.nama_cabang,
        no_telp: formData.no_telp,
        alamat: formData.alamat,
        email: formData.email,
        nama_kc: formData.nama_kc,
        jumlah_pegawai: parseInt(formData.jumlah_pegawai) || 0,
        tanggal_operasi: formData.tanggal_operasi,
        link_google_map: formData.link_google_map,
        nama_kas: formData.nama_kas,
        nomor_rekening: formData.nomor_rekening,
        kapasitas_box: parseInt(formData.kapasitas_box) || 0,
        kapasitas_kg: parseInt(formData.kapasitas_kg) || 0,
      };

      let result;
      if (cabang) {
        result = await updateCabang(cabang.id, data);
      } else {
        result = await addCabang(data);
      }

      if (result.success) {
        const successMessage = result.message || 'Data berhasil disimpan';
        alert(successMessage);
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error saving cabang:', error);
      setError('Terjadi kesalahan saat menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cabang ? 'EDIT CABANG' : 'TAMBAH CABANG'}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}

        <div>
          <label className="block text-gray-700 mb-2">
            Jenis Kantor <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.jenis_kantor}
            onChange={(e) => setFormData({ ...formData, jenis_kantor: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">-- Pilih Jenis Kantor --</option>
            <option value="Pusat">Pusat</option>
            <option value="Cabang">Cabang</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Kode Cabang</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.kode_cabang}
            onChange={(e) => setFormData({ ...formData, kode_cabang: e.target.value })}
            placeholder="Maksimal 3 digit"
            maxLength={3}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">
            Nama Kantor <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nama_cabang}
            onChange={(e) => setFormData({ ...formData, nama_cabang: e.target.value })}
            disabled={isSubmitting}
            placeholder="Masukkan nama kantor"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">No Telepon</label>
          <input
  type="text"
  className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
  value={formData.no_telp}
  onChange={(e) => {
    // Hanya izinkan angka
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setFormData({ ...formData, no_telp: value });
    } else {
      setError("No Telepon hanya boleh angka");
    }
  }}
  disabled={isSubmitting}
  placeholder="Contoh: 0274123456"
/>

        </div>

        <div>
          <label className="block text-gray-700 mb-2">Alamat</label>
          <textarea
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.alamat}
            onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
            rows={3}
            disabled={isSubmitting}
            placeholder="Masukkan alamat lengkap"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={isSubmitting}
            placeholder="Contoh: kantor@example.com"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Nama KC</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nama_kc}
            onChange={(e) => setFormData({ ...formData, nama_kc: e.target.value })}
            disabled={isSubmitting}
            placeholder="Nama Kepala Cabang"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Jumlah Pegawai</label>
          <input
            type="number"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.jumlah_pegawai}
            onChange={(e) => setFormData({ ...formData, jumlah_pegawai: e.target.value })}
            disabled={isSubmitting}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Tanggal Operasi</label>
          <input
            type="date"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.tanggal_operasi}
            onChange={(e) => setFormData({ ...formData, tanggal_operasi: e.target.value })}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Link Google Map</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.link_google_map}
            onChange={(e) => setFormData({ ...formData, link_google_map: e.target.value })}
            disabled={isSubmitting}
            placeholder="https://maps.google.com/..."
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-3">Data Kas (Otomatis)</h3>
          
          <div className="mb-3">
            <label className="block text-gray-700 mb-2">
              Nama Kas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
              value={formData.nama_kas}
              onChange={(e) => setFormData({ ...formData, nama_kas: e.target.value })}
              placeholder="Contoh: Kas Utama Pusat"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Kas akan otomatis dibuat dengan tipe "Bank"
            </p>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Nomor Rekening</label>
           <input
  type="text"
  className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
  value={formData.nomor_rekening}
  onChange={(e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setFormData({ ...formData, nomor_rekening: value });
    } else {
      setError("Nomor Rekening hanya boleh angka");
    }
  }}
  placeholder="Contoh: 1234567890"
  disabled={isSubmitting}
/>

          </div>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Kapasitas Jerigen</label>
          <input
            type="number"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.kapasitas_box}
            onChange={(e) => setFormData({ ...formData, kapasitas_box: e.target.value })}
            disabled={isSubmitting}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Kapasitas Kg</label>
          <input
            type="number"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.kapasitas_kg}
            onChange={(e) => setFormData({ ...formData, kapasitas_kg: e.target.value })}
            disabled={isSubmitting}
            placeholder="0"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan'
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
  );
}