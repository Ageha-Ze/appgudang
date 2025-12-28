'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { SuplierData } from '@/types/suplier';
import SingleOverlay from '../../../components/SingleOverlay';

interface SuplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  suplier: SuplierData | null;
  onSuccess: () => void;
}

export default function SuplierModal({ isOpen, onClose, suplier, onSuccess }: SuplierModalProps) {
  const [cabangList, setCabangList] = useState<Array<{ id: number; nama_cabang: string }>>([]);
  const [formData, setFormData] = useState({
    cabang_id: '',
    nama: '',
    alamat: '',
    no_telp: '',
    email: '',
    website: '',
    no_rekening: '',
    nama_bank: '',
    daerah_operasi: '',
    tanggal_order_terakhir: '',
  });

  useEffect(() => {
    const loadCabang = async () => {
      try {
        const response = await fetch('/api/master/cabang');
        const result = await response.json();
        if (result.success) {
          setCabangList(result.data);
        }
      } catch (error) {
        console.error('Error loading cabang:', error);
      }
    };
    loadCabang();
  }, []);

  useEffect(() => {
    if (suplier) {
      setFormData({
        cabang_id: suplier.cabang_id.toString(),
        nama: suplier.nama,
        alamat: suplier.alamat,
        no_telp: suplier.no_telp,
        email: suplier.email,
        website: suplier.website,
        no_rekening: suplier.no_rekening,
        nama_bank: suplier.nama_bank,
        daerah_operasi: suplier.daerah_operasi,
        tanggal_order_terakhir: suplier.tanggal_order_terakhir,
      });
    } else {
      setFormData({
        cabang_id: '',
        nama: '',
        alamat: '',
        no_telp: '',
        email: '',
        website: '',
        no_rekening: '',
        nama_bank: '',
        daerah_operasi: '',
        tanggal_order_terakhir: '',
      });
    }
  }, [suplier]);

  const handleSubmit = async () => {
    if (!formData.nama || !formData.cabang_id) {
      alert('Nama Suplier dan Kantor harus diisi');
      return;
    }

    const data = {
      cabang_id: parseInt(formData.cabang_id),
      nama: formData.nama,
      alamat: formData.alamat,
      no_telp: formData.no_telp,
      email: formData.email,
      website: formData.website,
      no_rekening: formData.no_rekening,
      nama_bank: formData.nama_bank,
      daerah_operasi: formData.daerah_operasi,
      tanggal_order_terakhir: formData.tanggal_order_terakhir,
    };

    try {
      let response;
      if (suplier) {
        response = await fetch(`/api/master/supplier?id=${suplier.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch('/api/master/supplier', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      }

      const result = await response.json();

      if (response.ok && (result.message || result.data)) {
        onSuccess();
        onClose();
      } else {
        alert(result.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error submitting supplier:', error);
      alert('Terjadi kesalahan saat menyimpan data');
    }
  };

  return (
    <SingleOverlay>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={suplier ? 'EDIT SUPPLIER' : 'TAMBAH SUPPLIER'}
      >
      <div className="space-y-4">
        {suplier && (
          <div>
            <label className="block text-gray-700 mb-2">Kode Suplier</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg"
              value={`SPL-${String(suplier.id).padStart(3, '0')}`}
              disabled
              placeholder="Auto Generate"
            />
          </div>
        )}

        <div>
          <label className="block text-gray-700 mb-2">Kantor</label>
          <select
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.cabang_id}
            onChange={(e) => setFormData({ ...formData, cabang_id: e.target.value })}
          >
            <option value="">-- Pilih Kantor --</option>
            {cabangList.map((cabang) => (
              <option key={cabang.id} value={cabang.id}>
                {cabang.nama_cabang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Nama Suplier</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Alamat</label>
          <textarea
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.alamat}
            onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
            rows={3}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">No Telepon</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.no_telp}
            onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Website</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">No Rekening</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.no_rekening}
            onChange={(e) => setFormData({ ...formData, no_rekening: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Nama Bank</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.nama_bank}
            onChange={(e) => setFormData({ ...formData, nama_bank: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Daerah Operasi</label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.daerah_operasi}
            onChange={(e) => setFormData({ ...formData, daerah_operasi: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-2">Tanggal Order Terakhir</label>
          <input
            type="date"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg"
            value={formData.tanggal_order_terakhir}
            onChange={(e) => setFormData({ ...formData, tanggal_order_terakhir: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
          >
            Simpan
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
    </SingleOverlay>
  );
}
