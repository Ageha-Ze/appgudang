'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { ProdukData } from '@/types/produk';
import { AlertCircle, Loader2, Info, Droplets } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ProdukModalProps {
  isOpen: boolean;
  onClose: () => void;
  produk: ProdukData | null;
  onSuccess: () => void;
}

export default function ProdukModal({ isOpen, onClose, produk, onSuccess }: ProdukModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    kode_produk: '',
    nama_produk: '',
    harga: '',
    hpp: '',
    stok: '',
    satuan: '',
    is_jerigen: false,
    density_kg_per_liter: '1.0',
    allow_manual_conversion: false,
  });

  useEffect(() => {
    if (produk) {
      setFormData({
        kode_produk: produk.kode_produk || '',
        nama_produk: produk.nama_produk,
        harga: produk.harga.toString(),
        hpp: produk.hpp?.toString() || '',
        stok: produk.stok.toString(),
        satuan: produk.satuan,
        is_jerigen: produk.is_jerigen ?? false,
        density_kg_per_liter: produk.density_kg_per_liter?.toString() || '1.0',
        allow_manual_conversion: produk.allow_manual_conversion ?? false,
      });
    } else {
      setFormData({
        kode_produk: '',
        nama_produk: '',
        harga: '',
        hpp: '',
        stok: '',
        satuan: '',
        is_jerigen: false,
        density_kg_per_liter: '1.0',
        allow_manual_conversion: false,
      });
    }
    setError(null);
  }, [produk, isOpen]);

  const generateKodeProduk = (namaProduk: string) => {
    const prefix = namaProduk
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3)
      .padEnd(3, 'X');
    
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${timestamp}`;
  };

  const suggestDensity = (namaProduk: string): number => {
    const name = namaProduk.toLowerCase();
    
    if (name.includes('air') || name.includes('water')) return 1.0;
    if (name.includes('madu') || name.includes('honey') || name.includes('kelulut')) return 1.4;
    if (name.includes('minyak') || name.includes('oil') || name.includes('zaitun') || name.includes('olive')) return 0.92;
    if (name.includes('susu') || name.includes('milk')) return 1.03;
    
    return 1.0;
  };

  const calculateConversionPreview = (): string => {
    const density = parseFloat(formData.density_kg_per_liter);
    if (isNaN(density) || density <= 0) return '10 KG → ? ML';
    
    const ml = (10 / density) * 1000;
    return `10 KG → ${ml.toFixed(0)} ML`;
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validasi
    if (!formData.nama_produk) {
      setError('Nama Barang harus diisi');
      return;
    }

    if (!formData.satuan) {
      setError('Satuan harus dipilih');
      return;
    }

    const density = parseFloat(formData.density_kg_per_liter);
    if (formData.satuan === 'Kg' && (isNaN(density) || density <= 0)) {
      setError('Density harus diisi dengan nilai positif untuk produk KG');
      return;
    }

    setIsLoading(true);

    try {
      let kode = formData.kode_produk;
      if (!kode && !produk) {
        kode = generateKodeProduk(formData.nama_produk);
      }

      const data = {
        kode_produk: kode || null,
        nama_produk: formData.nama_produk,
        harga: parseFloat(formData.harga) || 0,
        hpp: parseFloat(formData.hpp) || null,
        stok: parseFloat(formData.stok) || 0,
        satuan: formData.satuan,
        is_jerigen: !!formData.is_jerigen,
        density_kg_per_liter: parseFloat(formData.density_kg_per_liter) || 1.0,
        allow_manual_conversion: !!formData.allow_manual_conversion,
      };

      let response;
      
      // ✅ PERBAIKAN: Gunakan fetch API
      if (produk) {
        response = await fetch(`/api/master/produk?id=${produk.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch('/api/master/produk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Terjadi kesalahan');
      }

      if (result.success) {
        // Success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
        successDiv.innerHTML = `
          <span class="text-green-600">✅</span>
          <div>
            <p class="font-semibold">${produk ? 'Produk Berhasil Diupdate!' : 'Produk Berhasil Ditambahkan!'}</p>
            <p class="text-sm">${data.nama_produk} telah disimpan dalam sistem.</p>
          </div>
          <button onclick="this.parentElement.remove()" class="text-green-700 hover:text-green-900 font-bold">×</button>
        `;
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 5000);

        onSuccess();
        onClose();
      } else {
        throw new Error(result.error || result.message || 'Terjadi kesalahan');
      }
    } catch (err: any) {
      console.error('Error saving produk:', err);
      setError(err.message || 'Terjadi kesalahan tidak terduga');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        kode_produk: '',
        nama_produk: '',
        harga: '',
        hpp: '',
        stok: '',
        satuan: '',
        is_jerigen: false,
        density_kg_per_liter: '1.0',
        allow_manual_conversion: false,
      });
      setError(null);
      onClose();
    }
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, nama_produk: value });
    
    if (!produk && formData.density_kg_per_liter === '1.0') {
      const suggested = suggestDensity(value);
      if (suggested !== 1.0) {
        setFormData(prev => ({ 
          ...prev, 
          nama_produk: value,
          density_kg_per_liter: suggested.toString() 
        }));
      }
    }
  };

  return (
    <SingleOverlay>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={produk ? 'UBAH BARANG' : 'TAMBAH BARANG'}
      >
      <div className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Kode Barang */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Kode Barang {!produk && <span className="text-xs text-gray-500">(opsional, auto-generate jika kosong)</span>}
          </label>
          <input
            type="text"
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              produk ? 'bg-gray-100' : 'bg-blue-50'
            }`}
            value={formData.kode_produk}
            onChange={(e) => setFormData({ ...formData, kode_produk: e.target.value.toUpperCase() })}
            placeholder={produk ? 'Kode tidak bisa diubah' : 'Contoh: MDU001 (kosongkan untuk auto-generate)'}
            disabled={!!produk || isLoading}
          />
          {!produk && formData.nama_produk && !formData.kode_produk && (
            <p className="text-xs text-blue-600 mt-1">
              Akan di-generate otomatis: {generateKodeProduk(formData.nama_produk)}
            </p>
          )}
        </div>

        {/* Nama Barang */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Nama Barang <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={formData.nama_produk}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Contoh: Madu Hutan Liar"
            disabled={isLoading}
            required
          />
        </div>

        {/* Grid 2 Kolom: Satuan & Is Jerigen */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Satuan <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={formData.satuan}
              onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
              disabled={isLoading}
              required
            >
              <option value="">-- Pilih Satuan --</option>
              <option value="Kg">Kilogram (Kg)</option>
              <option value="Gr">Gram (Gr)</option>
              <option value="Liter">Liter</option>
              <option value="Ml">Mililiter (Ml)</option>
              <option value="Pcs">Pieces (Pcs)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Type</label>
            <div className="flex items-center h-10 mt-1">
              <input
                type="checkbox"
                id="is_jerigen"
                checked={formData.is_jerigen}
                onChange={(e) =>
                  setFormData({ ...formData, is_jerigen: e.target.checked })
                }
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="is_jerigen" className="ml-2 text-gray-700">
                Bundles (Jerigen, Drum, Box, dll)
              </label>
            </div>
          </div>
        </div>

        {/* DENSITY SECTION - Only show for KG products */}
        {formData.satuan === 'Kg' && (
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Droplets className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <label className="block text-gray-800 font-semibold mb-1">
                  Density (kg/L) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  Untuk konversi otomatis KG → ML saat unloading
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.density_kg_per_liter}
                  onChange={(e) => setFormData({ ...formData, density_kg_per_liter: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-cyan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                  placeholder="1.0"
                  disabled={isLoading}
                  required={formData.satuan === 'Kg'}
                />
              </div>
              <div className="flex items-center">
                <div className="text-xs bg-white border border-cyan-200 rounded-lg px-3 py-2 w-full">
                  <span className="text-gray-500">Preview:</span><br/>
                  <span className="font-mono text-cyan-700 font-semibold">
                    {calculateConversionPreview()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-cyan-200">
              <p className="text-xs text-gray-600 w-full mb-1">Quick Presets:</p>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, density_kg_per_liter: '1.0' })}
                className="text-xs px-2 py-1 bg-white border border-cyan-300 rounded hover:bg-cyan-50 transition"
                disabled={isLoading}
              >
                Air (1.0)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, density_kg_per_liter: '1.4' })}
                className="text-xs px-2 py-1 bg-white border border-cyan-300 rounded hover:bg-cyan-50 transition"
                disabled={isLoading}
              >
                Madu (1.4)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, density_kg_per_liter: '0.92' })}
                className="text-xs px-2 py-1 bg-white border border-cyan-300 rounded hover:bg-cyan-50 transition"
                disabled={isLoading}
              >
                Minyak (0.92)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, density_kg_per_liter: '1.03' })}
                className="text-xs px-2 py-1 bg-white border border-cyan-300 rounded hover:bg-cyan-50 transition"
                disabled={isLoading}
              >
                Susu (1.03)
              </button>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  <strong>Contoh penggunaan:</strong><br/>
                  Unloading 10 KG madu (density {formData.density_kg_per_liter}) akan otomatis menjadi{' '}
                  <strong className="text-blue-900">
                    {(() => {
                      const d = parseFloat(formData.density_kg_per_liter);
                      return isNaN(d) || d <= 0 ? '?' : ((10 / d) * 1000).toFixed(0);
                    })()} ML
                  </strong> produk kiloan
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid 2 Kolom: HPP & Harga Jual */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              HPP (Harga Pokok)
            </label>
            <input
              type="number"
              className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={formData.hpp}
              onChange={(e) => setFormData({ ...formData, hpp: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Harga Jual
            </label>
            <input
              type="number"
              className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={formData.harga}
              onChange={(e) => setFormData({ ...formData, harga: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Stok */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Stok Awal</label>
          <input
            type="number"
            className="w-full px-4 py-2 bg-blue-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={formData.stok}
            onChange={(e) => setFormData({ ...formData, stok: e.target.value })}
            placeholder="0"
            min="0"
            step="0.01"
            disabled={isLoading}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Menyimpan...' : (produk ? 'Update' : 'Simpan')}
          </button>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
        </div>
      </div>
    </Modal>
    </SingleOverlay>
  );
}
