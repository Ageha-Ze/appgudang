'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { CicilanHutangUmum } from '@/types/hutang';

interface HistoryCicilanProps {
  hutangId: number;
  onUpdate: () => void;
}

export default function HistoryCicilan({ hutangId, onUpdate }: HistoryCicilanProps) {
  const [cicilans, setCicilans] = useState<CicilanHutangUmum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCicilans();
  }, [hutangId]);

  const fetchCicilans = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/keuangan/hutang-umum/${hutangId}/cicilan`);
      const json = await res.json();
      setCicilans(json.data || []);
    } catch (error) {
      console.error('Error fetching cicilans:', error);
      setCicilans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cicilanId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus cicilan ini?')) return;

    try {
      const res = await fetch(
        `/api/keuangan/hutang-umum/${hutangId}/cicilan?cicilanId=${cicilanId}&hutangId=${hutangId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        alert('Cicilan berhasil dihapus');
        fetchCicilans();
        onUpdate();
      } else {
        alert('Gagal menghapus cicilan');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const totalCicilan = cicilans.reduce(
    (sum, c) => sum + Number(c.jumlah_cicilan || 0),
    0
  );

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="font-bold text-lg mb-4 underline">History Cicilan Hutang</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Cicilan</p>
          <p className="text-xl font-bold text-blue-600">
            Rp. {totalCicilan.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-yellow-100">
            <tr>
              <th className="px-4 py-3 text-left">No</th>
              <th className="px-4 py-3 text-left">Tanggal Cicilan</th>
              <th className="px-4 py-3 text-left">Rekening</th>
              <th className="px-4 py-3 text-right">Jumlah Cicilan</th>
              <th className="px-4 py-3 text-left">Keterangan</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : cicilans.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  Belum ada cicilan
                </td>
              </tr>
            ) : (
              cicilans.map((item, index) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">
                    {new Date(item.tanggal_cicilan).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">{item.kas?.nama_kas || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    Rp. {Number(item.jumlah_cicilan).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3">{item.keterangan || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {cicilans.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="bg-gray-100 px-4 py-2 rounded">
            <span className="font-semibold">Total Cicilan: </span>
            <span className="text-lg font-bold">
              Rp. {totalCicilan.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
