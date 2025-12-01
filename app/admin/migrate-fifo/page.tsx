'use client';

import { useState, useEffect } from 'react';
import { Database, AlertCircle, CheckCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function MigrateFIFOPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [includePenjualan, setIncludePenjualan] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/admin/migrate-fifo');
      const json = await res.json();
      setStatus(json);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const runMigration = async () => {
    if (!confirm('Apakah Anda yakin ingin menjalankan migrasi? Proses ini akan memasukkan semua data pembelian dan penjualan yang sudah di-billing ke sistem FIFO.')) {
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch('/api/admin/migrate-fifo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_penjualan: includePenjualan,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setResult(json);
        checkStatus(); // Refresh status
        alert('Migrasi berhasil!');
      } else {
        alert('Gagal migrasi: ' + json.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-500 p-3 rounded">
                <Database className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-blue-600">
                  Migrasi Data ke Sistem FIFO
                </h1>
                <p className="text-sm text-gray-600">
                  Import data pembelian existing ke sistem tracking FIFO
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <AlertCircle className="text-yellow-400 mr-3" size={24} />
                <div>
                  <h3 className="font-bold text-yellow-800">Perhatian!</h3>
                  <p className="text-sm text-yellow-700">
                    Proses ini akan memasukkan semua data pembelian yang sudah di-billing
                    ke tabel <code>stock_movement_fifo</code>. Pastikan Anda sudah backup
                    database sebelum menjalankan migrasi.
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            {status && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="font-bold text-lg mb-4">Status Database</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded">
                    <p className="text-sm text-gray-600 mb-1">Total Pembelian (Billed)</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {status.total_pembelian_billed}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <p className="text-sm text-gray-600 mb-1">Sudah di FIFO</p>
                    <p className="text-2xl font-bold text-green-600">
                      {status.total_batches_in_fifo}
                    </p>
                  </div>
                  <div
                    className={`p-4 rounded ${
                      status.need_migration ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <p
                      className={`text-lg font-bold ${
                        status.need_migration ? 'text-red-600' : 'text-gray-600'
                      }`}
                    >
                      {status.need_migration ? 'Perlu Migrasi' : 'Sudah Lengkap'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="font-bold text-lg mb-4">Jalankan Migrasi</h2>
              
              {/* Checkbox Include Penjualan */}
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePenjualan}
                    onChange={(e) => setIncludePenjualan(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <p className="font-semibold">Include Penjualan (Apply FIFO)</p>
                    <p className="text-sm text-gray-600">
                      Centang ini untuk juga memproses data penjualan dan menghitung HPP dengan FIFO.
                      Proses ini akan lebih lama tapi HPP akan akurat.
                    </p>
                  </div>
                </label>
              </div>

              <p className="text-gray-600 mb-4">
                Klik tombol di bawah untuk memulai proses migrasi data.
              </p>
              <button
                onClick={runMigration}
                disabled={loading || (status && !status.need_migration)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Memproses...' : 'Mulai Migrasi'}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="text-green-600" size={24} />
                  <h2 className="font-bold text-lg text-green-600">Migrasi Selesai!</h2>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-700 mb-2">Pembelian</h3>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Diproses</span>
                    <span className="font-bold">
                      {result.summary.pembelian.total_processed}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Batch Dibuat</span>
                    <span className="font-bold">
                      {result.summary.pembelian.batches_created}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b mb-4">
                    <span className="text-gray-600">Stock</span>
                    <span className="font-bold">
                      {result.summary.pembelian.stock_migrated.toLocaleString('id-ID')} Kg
                    </span>
                  </div>

                  {result.summary.penjualan.included && (
                    <>
                      <h3 className="font-semibold text-gray-700 mb-2 mt-4">Penjualan</h3>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-600">Total Diproses</span>
                        <span className="font-bold">
                          {result.summary.penjualan.processed}
                        </span>
                      </div>
                    </>
                  )}

                  <h3 className="font-semibold text-gray-700 mb-2 mt-4">Stock Akhir</h3>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Stock</span>
                    <span className="font-bold">
                      {result.summary.stock_akhir.total_stock.toLocaleString('id-ID')} Kg
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Nilai Stock</span>
                    <span className="font-bold">
                      Rp. {result.summary.stock_akhir.nilai_stock.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {result.summary.errors > 0 && (
                    <div className="flex justify-between py-2 text-red-600 mt-4">
                      <span>Errors</span>
                      <span className="font-bold">{result.summary.errors}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
