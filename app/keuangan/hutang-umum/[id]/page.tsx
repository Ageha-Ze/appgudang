'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { HutangUmum } from '@/types/hutang';
import ModalCicilan from './ModalCicilan';
import ModalPelunasan from './ModalPelunasan';
import ModalEditHutang from './ModalEditHutang';
import HistoryCicilan from './HistoryCicilan';

export default function DetailHutangPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [id, setId] = useState<string>('');
  const [hutang, setHutang] = useState<HutangUmum | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModalCicilan, setShowModalCicilan] = useState(false);
  const [showModalPelunasan, setShowModalPelunasan] = useState(false);
  const [showModalEdit, setShowModalEdit] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (id) {
      fetchHutang();
    }
  }, [id]);

  const fetchHutang = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/keuangan/hutang-umum/${id}`);
      const json = await res.json();

      // ✅ FIX: Recalculate dibayar from cicilan sum if data is corrupted
      let hutangData = json.data;

      if (hutangData) {
        // Get actual cicilan sum
        const cicilanRes = await fetch(`/api/keuangan/hutang-umum/${id}/cicilan`);
        const cicilanJson = await cicilanRes.json();
        const cicilanData = cicilanJson.data || [];
        const actualDibayar = cicilanData.reduce(
          (sum: number, c: any) => sum + Number(c.jumlah_cicilan || 0),
          0
        );

        // Fix corrupted data
        if (Number(hutangData.dibayar) !== actualDibayar) {
          console.warn(`🔧 Fixing corrupted hutang data: dibayar ${hutangData.dibayar} → ${actualDibayar}`);

          const correctedSisa = Math.max(0, Number(hutangData.nominal_total) - actualDibayar);

          hutangData = {
            ...hutangData,
            dibayar: actualDibayar,
            sisa: correctedSisa,
            status: actualDibayar >= Number(hutangData.nominal_total) ? 'Lunas' : 'Belum Lunas'
          };

          // Update the database with corrected values
          await fetch(`/api/keuangan/hutang-umum/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jenis_hutang: hutangData.jenis_hutang,
              tanggal_transaksi: hutangData.tanggal_transaksi,
              pihak: hutangData.pihak,
              keterangan: hutangData.keterangan,
              nominal_total: hutangData.nominal_total,
              kas_id: hutangData.kas_id
            })
          });
        }
      }

      setHutang(hutangData);

      // ✅ Close modals if hutang becomes lunas after data correction
      if (hutangData.status === 'Lunas') {
        setShowModalCicilan(false);
        setShowModalPelunasan(false);
        setShowModalEdit(false);
      } else if (showModalPelunasan) {
        // Force re-render modal with corrected data only if still not lunas
        setShowModalPelunasan(false);
        setTimeout(() => setShowModalPelunasan(true), 100);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
          <div className="flex-1 flex items-center justify-center">Loading...</div>
        </div>
    );
  }

  if (!hutang) {
    return (
      <div className="flex h-screen bg-gray-50">        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center">Data tidak ditemukan</div>
        </div>
      </div>
    );
  }

  const isLunas = hutang.status === 'Lunas';

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
     
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push('/keuangan/hutang-umum')}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <p className="text-sm text-gray-600">Keuangan</p>
              <h1 className="text-2xl font-bold text-red-600">Detail Hutang</h1>
            </div>
          </div>

      {/* Data Hutang */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="font-bold text-lg mb-4 underline">Data Hutang</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex gap-4">
              <label className="w-48">Jenis Hutang</label>
              <span className="flex-1 px-3 py-1 bg-gray-100 rounded capitalize">
                {hutang.jenis_hutang}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Tanggal Transaksi</label>
              <span className="flex-1 px-3 py-1 bg-gray-100 rounded">
                {new Date(hutang.tanggal_transaksi).toLocaleDateString('id-ID')}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Pihak</label>
              <span className="flex-1 px-3 py-1 bg-gray-100 rounded">
                {hutang.pihak}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Rekening</label>
              <span className="flex-1 px-3 py-1 bg-gray-100 rounded">
                {hutang.kas?.nama_kas || '-'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-4">
              <label className="w-48">Nominal Total</label>
              <span className="flex-1 px-3 py-1 bg-gray-100 rounded">
                Rp. {Number(hutang.nominal_total).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Sudah Dibayar</label>
              <span className="flex-1 px-3 py-1 bg-green-100 rounded">
                Rp. {Number(hutang.dibayar).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Sisa</label>
              <span className="flex-1 px-3 py-1 bg-red-100 rounded font-bold">
                Rp. {Number(hutang.sisa).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex gap-4">
              <label className="w-48">Status</label>
              <span
                className={`flex-1 px-3 py-1 rounded ${
                  isLunas ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {isLunas ? 'Lunas' : 'Belum Lunas'}
              </span>
            </div>
          </div>
        </div>

        {hutang.keterangan && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Keterangan</label>
            <p className="px-3 py-2 bg-gray-100 rounded">{hutang.keterangan}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => router.push('/keuangan/hutang-umum')}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Kembali
          </button>

          {!isLunas && (
            <>
              <button
                onClick={() => setShowModalCicilan(true)}
                className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
              >
                Cicil
              </button>

              <button
                onClick={() => setShowModalPelunasan(true)}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Lunas
              </button>
            </>
          )}

          <button
            onClick={() => setShowModalEdit(true)}
            className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Edit Data
          </button>
        </div>
      </div>

      {/* History Cicilan */}
      <HistoryCicilan hutangId={parseInt(id)} onUpdate={fetchHutang} />

      {/* Modals */}
      <ModalCicilan
        isOpen={showModalCicilan}
        onClose={() => setShowModalCicilan(false)}
        onSuccess={fetchHutang}
        hutangId={parseInt(id)}
        sisaHutang={Number(hutang.sisa)}
      />

      <ModalPelunasan
        isOpen={showModalPelunasan}
        onClose={() => setShowModalPelunasan(false)}
        onSuccess={fetchHutang}
        hutangId={parseInt(id)}
        sisaHutang={Number(hutang.sisa)}
      />

      <ModalEditHutang
        isOpen={showModalEdit}
        onClose={() => setShowModalEdit(false)}
        onSuccess={fetchHutang}
        hutang={hutang}
      />
        </main>
      </div>
    </div>
  );
}
