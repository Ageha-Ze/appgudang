'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface ModalPrintNotaProps {
  isOpen: boolean;
  onClose: () => void;
  penjualanId: number;
}

interface DetailPenjualan {
  id: number;
  jumlah: number;
  harga: number;
  subtotal: number;
  produk: {
    nama_produk: string;
  };
}

interface PenjualanData {
  id: number;
  tanggal: string;
  nota_penjualan: string;
  jenis_pembayaran: string;
  customer: {
    nama: string;
  };
  pegawai: {
    nama: string;
    cabang: {
      nama_cabang: string;
      alamat: string;
      no_telp: string;
      email: string;
    };
  };
  detail_penjualan: DetailPenjualan[];
  biaya_ongkir: number;
  biaya_potong: number;
  nilai_diskon: number;
  uang_muka: number;
  total: number;
}

export default function ModalPrintNota({
  isOpen,
  onClose,
  penjualanId,
}: ModalPrintNotaProps) {
  const [penjualan, setPenjualan] = useState<PenjualanData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && penjualanId) {
      fetchPenjualan();
    }
  }, [isOpen, penjualanId]);

  const fetchPenjualan = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/penjualan/${penjualanId}`);
      const json = await res.json();
      setPenjualan(json.data);
    } catch (error) {
      console.error('Error fetching penjualan:', error);
      alert('Gagal memuat data penjualan');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current || !penjualan) return;
    
    const content = printRef.current.innerHTML;
    onClose();
    
    setTimeout(() => {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Popup diblokir! Harap izinkan popup untuk website ini.');
        return;
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Nota Penjualan - ${penjualan.nota_penjualan}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, sans-serif;
                padding: 20mm;
                color: #000;
              }
              .container {
                max-width: 800px;
                margin: 0 auto;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
              }
              th, td {
                border: 1px solid #333;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
              }
              .text-right {
                text-align: right;
              }
              .text-center {
                text-align: center;
              }
              .font-bold {
                font-weight: bold;
              }
              .text-lg {
                font-size: 18px;
              }
              .text-2xl {
                font-size: 24px;
              }
              .text-3xl {
                font-size: 30px;
              }
              .mb-2 { margin-bottom: 8px; }
              .mb-4 { margin-bottom: 16px; }
              .mb-6 { margin-bottom: 24px; }
              .mb-8 { margin-bottom: 32px; }
              .mt-12 { margin-top: 48px; }
              .py-2 { padding-top: 8px; padding-bottom: 8px; }
              .px-3 { padding-left: 12px; padding-right: 12px; }
              .px-8 { padding-left: 32px; padding-right: 32px; }
              .pt-2 { padding-top: 8px; }
              .grid {
                display: grid;
              }
              .grid-cols-2 {
                grid-template-columns: repeat(2, 1fr);
              }
              .gap-2 { gap: 8px; }
              .gap-4 { gap: 16px; }
              .gap-8 { gap: 32px; }
              .border-t {
                border-top: 1px solid #333;
              }
              .border-t-2 {
                border-top: 2px solid #333;
              }
              .border-b {
                border-bottom: 1px solid #333;
              }
              hr {
                border: none;
                border-top: 2px solid #333;
                margin: 16px 0;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${content}
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    }, 300);
  };

  if (!isOpen) return null;

  const subtotal = penjualan?.detail_penjualan?.reduce(
    (sum, item) => sum + item.subtotal,
    0
  ) || 0;

  const grandTotal = 
    subtotal + 
    (penjualan?.biaya_ongkir || 0) + 
    (penjualan?.biaya_potong || 0) - 
    (penjualan?.nilai_diskon || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-500 to-blue-600">
          <h2 className="text-xl font-bold text-white">Preview Nota Penjualan</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              <Printer size={18} />
              Print Document
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition font-semibold"
            >
              <X size={18} />
              Close Window
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Memuat data...</p>
              </div>
            </div>
          ) : !penjualan ? (
            <div className="text-center py-12">
              <p className="text-red-600 text-lg font-semibold">Data tidak ditemukan</p>
              <p className="text-sm text-gray-500 mt-2">Penjualan ID: {penjualanId}</p>
            </div>
          ) : (
            <div ref={printRef} className="max-w-4xl mx-auto">
              {/* Company Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2" style={{ color: '#4f46e5' }}>
                  {penjualan.pegawai?.cabang?.nama_cabang || 'Nama Cabang'}
                </h1>
                <p style={{ color: '#666' }}>{penjualan.pegawai?.cabang?.alamat || '-'}</p>
                <p style={{ color: '#666' }}>{penjualan.pegawai?.cabang?.no_telp || '-'}</p>
                <p style={{ color: '#666' }}>{penjualan.pegawai?.cabang?.email || '-'}</p>
              </div>

              <hr style={{ borderTop: '2px solid #333', margin: '16px 0' }} />

              {/* Document Title */}
              <h2 className="text-2xl font-bold text-center mb-6">NOTA PENJUALAN BARANG</h2>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-8 mb-6" style={{ fontSize: '14px' }}>
                <div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>No. Nota</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.nota_penjualan}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Tanggal Jual</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{new Date(penjualan.tanggal).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Rekening Pembayaran</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.jenis_pembayaran}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Cabang</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.pegawai?.cabang?.nama_cabang}</span>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Customer</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.customer?.nama}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Sales</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.pegawai?.nama}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Jenis Pembayaran</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{penjualan.jenis_pembayaran}</span>
                  </div>
                </div>
              </div>

              <hr style={{ borderTop: '1px solid #333', margin: '16px 0' }} />

              {/* Payment Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6" style={{ fontSize: '14px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '500' }}>Terbayar</span>
                    <span>Rp. {(penjualan.uang_muka || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '500' }}>Tagihan</span>
                    <span style={{ fontWeight: 'bold' }}>Rp. {(grandTotal - (penjualan.uang_muka || 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <hr style={{ borderTop: '2px solid #333', margin: '16px 0' }} />

              {/* Detail Title */}
              <h3 className="text-lg font-bold mb-4">DETAIL PENJUALAN</h3>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e0e7ff' }}>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Nama Produk</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Harga Jual</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>Box</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {penjualan.detail_penjualan.map((item, index) => (
                    <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ border: '1px solid #333', padding: '8px' }}>{item.produk.nama_produk}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>
                        Rp. {item.harga.toLocaleString('id-ID')}
                      </td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>
                        {item.jumlah.toFixed(2)}
                      </td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center' }}>0</td>
                      <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                        Rp. {item.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                <div style={{ width: '256px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Sub Total:</span>
                    <span style={{ fontWeight: '600' }}>Rp. {subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Uang Muka:</span>
                    <span>Rp. {(penjualan.uang_muka || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Nilai Disc:</span>
                    <span>Rp. {(penjualan.nilai_diskon || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Biaya Kirim:</span>
                    <span>Rp. {(penjualan.biaya_ongkir || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Biaya Potong:</span>
                    <span>Rp. {(penjualan.biaya_potong || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#e0e7ff', borderRadius: '4px', marginTop: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>Grand Total:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Rp. {grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Signature */}
              <div className="grid grid-cols-2 gap-8 text-center" style={{ paddingTop: '48px', fontSize: '14px' }}>
                <div>
                  <p style={{ marginBottom: '64px' }}>Mengetahui,</p>
                  <p style={{ fontWeight: '600', borderTop: '1px solid #666', display: 'inline-block', padding: '8px 32px' }}>
                    _______________
                  </p>
                  <p style={{ marginTop: '8px' }}>Customer</p>
                </div>
                <div>
                  <p style={{ marginBottom: '64px' }}>Mengetahui,</p>
                  <p style={{ fontWeight: '600', borderTop: '1px solid #666', display: 'inline-block', padding: '8px 32px' }}>
                    {penjualan.pegawai?.nama || '_______________'}
                  </p>
                  <p style={{ marginTop: '8px' }}>Sales</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-center gap-3">
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
          >
            Print Document
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
