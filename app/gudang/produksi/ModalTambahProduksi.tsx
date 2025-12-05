'use client';

import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface Produk { id: number; nama_produk: string; }
interface Pegawai { id: number; nama: string; }
interface Cabang { id: number; nama_cabang: string; }

interface ModalTambahProduksiProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (produksiId: number) => void;
}

export default function ModalTambahProduksi({ isOpen, onClose, onSuccess }: ModalTambahProduksiProps) {
  const [form, setForm] = useState({ 
    tanggal: new Date().toISOString().split('T')[0], 
    cabang_id: '',  // Pindah ke atas
    produk_id: '', 
    pegawai_id: '', 
    jumlah: '', 
    satuan: 'kg'
  });
  const [produks, setProduks] = useState<Produk[]>([]);
  const [pegawais, setPegawais] = useState<Pegawai[]>([]);
  const [cabangs, setCabangs] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduks, setLoadingProduks] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProduks([]); // reset dulu, belum pilih cabang
      fetchPegawais();
      fetchCabangs();
      // Reset form
      setForm({ 
        tanggal: new Date().toISOString().split('T')[0], 
        cabang_id: '', 
        produk_id: '', 
        pegawai_id: '', 
        jumlah: '', 
        satuan: 'kg'
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (form.cabang_id) {
      fetchProduks(form.cabang_id);
      fetchPegawaisByCabang(form.cabang_id); // Filter pegawai by cabang
    } else {
      setProduks([]); // Clear products when no cabang selected
      setPegawais([]); // Clear pegawai when no cabang selected
    }
  }, [form.cabang_id]);

  const fetchProduks = async (cabangId: string) => {
    if (!cabangId) return;
    try {
      setLoadingProduks(true);
      console.log('🔍 Fetching produk for cabang ID:', cabangId);
      const url = `/api/gudang/produksi/produk/${cabangId}`;
      console.log('📡 URL:', url);
      
      const res = await fetch(url);
      console.log('📥 Response status:', res.status);
      
      const json = await res.json();
      console.log('📦 Full response:', json);
      console.log('📊 Data array:', json.data);
      console.log('📈 Data length:', json.data?.length);
      
      if (!res.ok) {
        console.error('❌ API Error:', json.error);
        alert(`Error dari API: ${json.error}`);
        setProduks([]);
        return;
      }
      
      const products = json.data || [];
      console.log('✅ Products to set:', products);
      setProduks(products);
      
      if (products.length === 0) {
        console.warn('⚠️ No products returned from API for cabang:', cabangId);
      }
    } catch (error) {
      console.error('💥 Error fetching produk:', error);
      alert('Gagal memuat daftar produk. Cek console untuk detail.');
      setProduks([]);
    } finally {
      setLoadingProduks(false);
    }
  };

  const fetchPegawais = async () => {
    try {
      const res = await fetch('/api/master/pegawai');
      const json = await res.json();
      setPegawais(json.data || []);
    } catch (error) {
      console.error('Error fetching pegawai:', error);
    }
  };

  const fetchPegawaisByCabang = async (cabangId: string) => {
    if (!cabangId) {
      setPegawais([]);
      return;
    }
    try {
      const res = await fetch(`/api/master/pegawai?cabang_id=${cabangId}`);
      const json = await res.json();
      setPegawais(json.data || []);
    } catch (error) {
      console.error('Error fetching pegawai by cabang:', error);
      setPegawais([]);
    }
  };

  const fetchCabangs = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangs(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.cabang_id) {
      alert('Cabang harus dipilih!');
      return;
    }
    
    if (!form.produk_id) {
      alert('Produk harus dipilih!');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/gudang/produksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        alert('✅ Produksi berhasil ditambahkan!');
        onSuccess(json.data.id);
        setForm({ 
          tanggal: new Date().toISOString().split('T')[0], 
          cabang_id: '', 
          produk_id: '', 
          pegawai_id: '', 
          jumlah: '', 
          satuan: 'kg'
        });
        onClose();
      } else {
        alert('❌ Error: ' + json.error);
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-10 rounded-t-xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-violet-700">Tambah Produksi</h2>
            <p className="text-xs sm:text-sm text-gray-500">Catat hasil produksi baru</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-600 hover:text-gray-800 p-1"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Tanggal Produksi <span className="text-red-500">*</span>
            </label>
            <input 
              type="date" 
              value={form.tanggal} 
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })} 
              required 
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none" 
            />
          </div>

          {/* CABANG - PINDAH KE ATAS SEBELUM PRODUK! */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Cabang/Gudang <span className="text-red-500">*</span>
            </label>
            <select 
              value={form.cabang_id} 
              onChange={(e) => {
                setForm({ ...form, cabang_id: e.target.value, produk_id: '' }); // Reset produk saat ganti cabang
              }}
              required 
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
            >
              <option value="">-- Pilih Cabang Terlebih Dahulu --</option>
              {cabangs.map(c => (
                <option key={c.id} value={c.id}>{c.nama_cabang}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">📍 Pilih cabang untuk melihat daftar produk</p>
          </div>

          {/* PRODUK - SETELAH CABANG */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Produk <span className="text-red-500">*</span>
            </label>
            <select 
              value={form.produk_id} 
              onChange={(e) => setForm({ ...form, produk_id: e.target.value })} 
              required
              disabled={!form.cabang_id || loadingProduks}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!form.cabang_id 
                  ? '-- Pilih Cabang Dulu --' 
                  : loadingProduks 
                    ? 'Memuat produk...' 
                    : produks.length === 0 
                      ? 'Tidak ada produk tersedia'
                      : '-- Pilih Produk --'
                }
              </option>
              {produks.map(p => (
                <option key={p.id} value={p.id}>{p.nama_produk}</option>
              ))}
            </select>
            
            {/* Info jika belum pilih cabang */}
            {!form.cabang_id && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Silakan pilih cabang terlebih dahulu untuk melihat daftar produk yang tersedia
                </p>
              </div>
            )}
            
            {/* Info jika produk kosong setelah pilih cabang */}
            {form.cabang_id && !loadingProduks && produks.length === 0 && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  Tidak ada produk yang tersedia untuk cabang ini. Pastikan ada produk yang terdaftar.
                </p>
              </div>
            )}
          </div>

          {/* Pegawai */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Pegawai <span className="text-red-500">*</span>
            </label>
            <select 
              value={form.pegawai_id} 
              onChange={(e) => setForm({ ...form, pegawai_id: e.target.value })} 
              required 
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
            >
              <option value="">-- Pilih Pegawai --</option>
              {pegawais.map(p => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </div>

          {/* Jumlah & Satuan */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Jumlah <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                step="0.01"
                value={form.jumlah} 
                onChange={(e) => setForm({ ...form, jumlah: e.target.value })} 
                required 
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none" 
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Satuan</label>
              <select 
                value={form.satuan} 
                onChange={(e) => setForm({ ...form, satuan: e.target.value })} 
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                <option value="kg">Kg</option>
                <option value="gr">Gr</option>
                <option value="liter">Liter</option>
                <option value="ml">Ml</option>
                <option value="pcs">Pcs</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="w-full sm:flex-1 px-4 py-2 text-sm bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={loading || !form.cabang_id || !form.produk_id} 
              className="w-full sm:flex-1 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Menyimpan...' : 'Simpan Produksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
