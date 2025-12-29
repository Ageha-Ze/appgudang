'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import ModalEditCicilan from './ModalEditCicilan';

interface HistoryCicilanProps {
  penjualanId: number;
  onUpdate: () => void;
}

interface CicilanItem {
  id: number;
  tanggal_cicilan: string;
  jumlah_cicilan: number;
  keterangan: string;
  type?: string;
  kas?: {
    nama_kas: string;
  };
}

export default function HistoryCicilan({
  penjualanId,
  onUpdate,
}: HistoryCicilanProps) {
  const [cicilans, setCicilans] = useState<CicilanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCicilan, setSelectedCicilan] = useState<CicilanItem | null>(null);

  useEffect(() => {
    fetchCicilans();
  }, [penjualanId]);

  const fetchCicilans = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}/cicilan`);
      const json = await res.json();
      setCicilans(json.data || []);
    } catch (error) {
      console.error('Error fetching cicilans:', error);
      setCicilans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cicilan: CicilanItem) => {
    setSelectedCicilan(cicilan);
    setShowEditModal(true);
  };

  const handleDelete = async (cicilanId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus cicilan ini?')) return;

    try {
      const res = await fetch(
        `/api/transaksi/penjualan/${penjualanId}/cicilan/${cicilanId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        alert('Cicilan berhasil dihapus');
        fetchCicilans();
        onUpdate();
      } else {
        const error = await res.json();
        alert(error.error || 'Gagal menghapus cicilan');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const handleEditSuccess = () => {
    fetchCicilans();
    onUpdate();
  };

  if (loading) {
    return <div className="text-center py-4">Loading history...</div>;
  }

  if (cicilans.length === 0) {
    return null; // Tidak tampilkan jika belum ada cicilan
  }

  return (
    <div className="bg-white p-6 rounded shadow mt-6">
      <h2 className="font-bold text-lg mb-4 underline">History Cicilan Penjualan</h2>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-cyan-100">
            <tr>
              <th className="px-4 py-3 text-left">Tanggal Cicilan</th>
              <th className="px-4 py-3 text-right">Jumlah Cicilan</th>
              <th className="px-4 py-3 text-left">Rekening</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {cicilans.map((cicilan) => (
              <tr key={cicilan.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  {new Date(cicilan.tanggal_cicilan).toLocaleDateString('id-ID')}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  Rp. {parseFloat(cicilan.jumlah_cicilan.toString()).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3">{cicilan.kas?.nama_kas || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    cicilan.type === 'Pelunasan'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-cyan-100 text-cyan-800'
                  }`}>
                    {cicilan.type || 'Cicilan'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(cicilan)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(cicilan.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Memuat data...</p>
          </div>
        ) : cicilans.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada data cicilan
          </div>
        ) : (
          cicilans.map((cicilan) => (
            <div key={cicilan.id} className="bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-16 translate-x-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-12 -translate-x-12"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-cyan-100 mb-1">📅 Tanggal Cicilan</p>
                    <p className="font-mono text-base font-bold">{new Date(cicilan.tanggal_cicilan).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cyan-100 mb-1">Type</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      cicilan.type === 'Pelunasan'
                        ? 'bg-orange-400 text-orange-900'
                        : 'bg-green-400 text-green-900'
                    }`}>
                      {cicilan.type || 'Cicilan'}
                    </span>
                  </div>
                </div>

                {/* Cicilan Info */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏦</span>
                    <div className="flex-1">
                      <p className="text-xs text-cyan-100">Rekening</p>
                      <p className="text-sm font-semibold">{cicilan.kas?.nama_kas || '-'}</p>
                    </div>
                  </div>

                  {cicilan.keterangan && (
                    <div className="flex items-start gap-2">
                      <span className="text-lg">📝</span>
                      <div className="flex-1">
                        <p className="text-xs text-cyan-100">Keterangan</p>
                        <p className="text-sm font-semibold">{cicilan.keterangan}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/20 my-4"></div>

                {/* Amount */}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-cyan-100">Jumlah Cicilan</span>
                  <span className="text-2xl font-bold">
                    Rp. {parseFloat(cicilan.jumlah_cicilan.toString()).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(cicilan)}
                    className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cicilan.id)}
                    className="bg-red-500/80 hover:bg-red-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition border border-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Edit */}
      {selectedCicilan && (
        <ModalEditCicilan
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCicilan(null);
          }}
          onSuccess={handleEditSuccess}
          cicilan={selectedCicilan}
          penjualanId={penjualanId}
        />
      )}
    </div>
  );
}
