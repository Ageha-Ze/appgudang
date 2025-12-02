'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pembelianId: number;
}

interface PembelianDetail {
  id: number;
  tanggal: string;
  nota_supplier: string;
  total: number;
  uang_muka: number;
  biaya_kirim: number;
  tagihan: number;
  suplier?: {
    nama: string;
    alamat?: string;
    no_telp?: string;
  };
  cabang?: {
    nama_cabang: string;
    alamat?: string;
    no_telp?: string;
  };
  detail_pembelian?: Array<{
    id: number;
    jumlah: number;
    jumlah_box: number;
    harga: number;
    subtotal: number;
    produk?: {
      nama_produk: string;
      kode_produk: string;
      satuan: string;
    };
  }>;
}

export default function ModalPrintNotaPembelian({ isOpen, onClose, pembelianId }: Props) {
  const [data, setData] = useState<PembelianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && pembelianId) {
      fetchData();
    }
  }, [isOpen, pembelianId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/transaksi/pembelian/${pembelianId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    // Close modal first to prevent background print dialog
    const content = printRef.current.innerHTML;
    onClose();
    
    // Small delay to ensure modal is closed
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
            <title>Nota Pembelian - ${data?.nota_supplier || ''}</title>
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-500 to-purple-600">
          <h2 className="text-xl font-bold text-white">Preview Nota Pembelian</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white text-violet-600 rounded-lg hover:bg-gray-100 transition font-semibold"
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
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Memuat data...</p>
              </div>
            </div>
          ) : data ? (
            <div ref={printRef} className="max-w-4xl mx-auto">
              {/* Company Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2" style={{ color: '#7c3aed' }}>{data.cabang?.nama_cabang || 'Nama Perusahaan'}</h1>
                <p style={{ color: '#666' }}>{data.cabang?.alamat || 'Alamat Perusahaan'}</p>
                <p style={{ color: '#666' }}>{data.cabang?.no_telp || 'No Telp'}</p>
              </div>

              <hr style={{ borderTop: '2px solid #333', margin: '16px 0' }} />

              {/* Document Title */}
              <h2 className="text-2xl font-bold text-center mb-6">NOTA PEMBELIAN BARANG</h2>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-8 mb-6" style={{ fontSize: '14px' }}>
                <div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>No. Nota</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{data.nota_supplier}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Tanggal Beli</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{new Date(data.tanggal).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Cabang</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{data.cabang?.nama_cabang || '-'}</span>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', marginBottom: '4px' }}>
                    <span style={{ width: '160px', fontWeight: '500' }}>Supplier</span>
                    <span style={{ marginRight: '8px' }}>:</span>
                    <span>{data.suplier?.nama || '-'}</span>
                  </div>
                </div>
              </div>

              <hr style={{ borderTop: '1px solid #333', margin: '16px 0' }} />

              {/* Payment Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6" style={{ fontSize: '14px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '500' }}>Uang Muka</span>
                    <span>Rp. {data.uang_muka.toLocaleString('id-ID')}</span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '500' }}>Tagihan</span>
                    <span style={{ fontWeight: 'bold' }}>Rp. {data.tagihan.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <hr style={{ borderTop: '2px solid #333', margin: '16px 0' }} />

              {/* Detail Title */}
              <h3 className="text-lg font-bold mb-4">DETAIL PEMBELIAN</h3>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'left' }}>Nama Produk</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Harga Beli</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Qty</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Box</th>
                    <th style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detail_pembelian && data.detail_pembelian.length > 0 ? (
                    data.detail_pembelian.map((item, index) => (
                      <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                        <td style={{ border: '1px solid #333', padding: '8px' }}>{item.produk?.nama_produk || '-'}</td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>
                          Rp. {item.harga.toLocaleString('id-ID')}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>
                          {parseFloat(item.jumlah.toString()).toFixed(2)}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right' }}>
                          {item.jumlah_box || 0}
                        </td>
                        <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                          Rp. {item.subtotal.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ border: '1px solid #333', padding: '16px', textAlign: 'center', color: '#666' }}>
                        Tidak ada barang
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                <div style={{ width: '256px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Sub Total:</span>
                    <span style={{ fontWeight: '600' }}>
                      Rp. {(data.total - data.biaya_kirim).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: '500' }}>Biaya Kirim:</span>
                    <span style={{ fontWeight: '600' }}>Rp. {data.biaya_kirim.toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f3e8ff', borderRadius: '4px', marginTop: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>TOTAL:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Rp. {data.total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="grid grid-cols-2 gap-8 text-center" style={{ paddingTop: '48px', fontSize: '14px' }}>
                <div>
                  <p style={{ marginBottom: '64px' }}>Supplier</p>
                  <p style={{ fontWeight: '600', borderTop: '1px solid #666', display: 'inline-block', padding: '8px 32px' }}>
                    {data.suplier?.nama || '_______________'}
                  </p>
                </div>
                <div>
                  <p style={{ marginBottom: '64px' }}>Penerima</p>
                  <p style={{ fontWeight: '600', borderTop: '1px solid #666', display: 'inline-block', padding: '8px 32px' }}>
                    _______________
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Data tidak ditemukan</p>
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
