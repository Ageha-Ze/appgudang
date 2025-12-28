'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, Droplets, ArrowRight } from 'lucide-react';
import SingleOverlay from '../../../components/SingleOverlay';

interface ModalTambahUnloadingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Cabang {
  id: number;
  nama_cabang: string;
}

interface Produk {
  id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stok: number;
  is_jerigen: boolean;
  density_kg_per_liter?: number; // 🆕
}

interface ProdukWithBranchStock {
  produk_id: number;
  nama_produk: string;
  kode_produk: string;
  satuan: string;
  stock: number;
  cabang_id: number;
  cabang: string;
  density_kg_per_liter?: number; // 🆕
}

interface DetailItem {
  produk_jerigen_id: number;
  nama_jerigen: string;
  produk_kiloan_id: number;
  nama_kiloan: string;
  jumlah: number; // Input amount
  jumlah_output?: number; // 🆕 Calculated output (after conversion)
  satuan_input: string; // 🆕
  satuan_output: string; // 🆕
  density?: number; // 🆕
  conversion_type?: string | null; // 🆕 Fixed: Now accepts null
  stok_jerigen: number;
  keterangan: string;
}

export default function ModalTambahUnloading({
  isOpen,
  onClose,
  onSuccess,
}: ModalTambahUnloadingProps) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    cabang_id: '',
    keterangan: '',
  });

  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [produkJerigenList, setProdukJerigenList] = useState<ProdukWithBranchStock[]>([]);
  const [produkKiloanList, setProdukKiloanList] = useState<Produk[]>([]);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduk, setLoadingProduk] = useState(false);

  const [currentItem, setCurrentItem] = useState({
    produk_jerigen_id: '',
    produk_kiloan_id: '',
    jumlah: '',
    keterangan: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCabang();
      fetchProdukKiloan();
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        cabang_id: '',
        keterangan: '',
      });
      setDetailItems([]);
      setProdukJerigenList([]);
      setCurrentItem({ 
        produk_jerigen_id: '', 
        produk_kiloan_id: '', 
        jumlah: '', 
        keterangan: '' 
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.cabang_id) {
      fetchProdukJerigenByCabang(parseInt(formData.cabang_id));
    } else {
      setProdukJerigenList([]);
    }
  }, [formData.cabang_id]);

  const fetchCabang = async () => {
    try {
      const res = await fetch('/api/master/cabang');
      const json = await res.json();
      setCabangList(json.data || []);
    } catch (error) {
      console.error('Error fetching cabang:', error);
    }
  };

  const fetchProdukJerigenByCabang = async (cabangId: number) => {
    setLoadingProduk(true);
    try {
      const res = await fetch('/api/master/produk?limit=1000');
      const json = await res.json();
      const allProducts = json.data || [];
      
      const jerigenProducts = allProducts.filter((p: Produk) => p.is_jerigen === true);

      const jerigenWithBranchStock: ProdukWithBranchStock[] = [];
      
      for (const produk of jerigenProducts) {
        try {
          const stockRes = await fetch(
            `/api/persediaan/stock-barang/stock-lookup?produk_id=${produk.id}&cabang_id=${cabangId}`
          );
          
          if (stockRes.ok) {
            const stockData = await stockRes.json();
            
            if (stockData.success && stockData.data && stockData.data.stock > 0) {
              jerigenWithBranchStock.push({
                produk_id: stockData.data.produk_id,
                nama_produk: stockData.data.nama_produk,
                kode_produk: stockData.data.kode_produk,
                satuan: stockData.data.satuan,
                stock: parseFloat(stockData.data.stock.toString()),
                cabang_id: stockData.data.cabang_id,
                cabang: stockData.data.cabang,
                density_kg_per_liter: produk.density_kg_per_liter, // 🆕
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching stock for produk ${produk.id}:`, error);
        }
      }

      setProdukJerigenList(jerigenWithBranchStock);
      console.log(`✅ Loaded ${jerigenWithBranchStock.length} jerigen products with stock in cabang ${cabangId}`);
      
    } catch (error) {
      console.error('Error fetching produk jerigen:', error);
      setProdukJerigenList([]);
    } finally {
      setLoadingProduk(false);
    }
  };

  const fetchProdukKiloan = async () => {
    try {
      const res = await fetch('/api/master/produk?limit=1000');
      const json = await res.json();
      const allProducts = json.data || [];

      setProdukKiloanList(allProducts.filter((p: Produk) => {
        const isJerigen = p.is_jerigen === false;
        const isPcsExcluded = p.satuan?.toLowerCase() !== 'pcs';
        return isJerigen && isPcsExcluded;
      }));
    } catch (error) {
      console.error('Error fetching produk kiloan:', error);
    }
  };

  // ✅ SPECIAL: Filtered kiloan products (includes PCS if jerigen has Ml satuan)
  const updateProdukKiloanFiltered = (jerigenSatuan: string) => {
    try {
      // Fetch products and filter based on jerigen satuan
      fetch('/api/master/produk?limit=1000')
        .then(res => res.json())
        .then(json => {
          const allProducts = json.data || [];

          setProdukKiloanList(allProducts.filter((p: Produk) => {
            const isJerigen = p.is_jerigen === false;
            // ✅ INCLUDE PCS ONLY if jerigen satuan is 'Ml'
            const isPcsIncluded = jerigenSatuan.toLowerCase() === 'ml' ?
              true : p.satuan?.toLowerCase() !== 'pcs';
            return isJerigen && isPcsIncluded;
          }));
        })
        .catch(error => {
          console.error('Error fetching filtered produk kiloan:', error);
        });
    } catch (error) {
      console.error('Error updating produk kiloan:', error);
    }
  };

  // 🆕 Calculate conversion preview
  const getConversionPreview = () => {
    if (!currentItem.produk_jerigen_id || !currentItem.produk_kiloan_id || !currentItem.jumlah) {
      return null;
    }

    const produkJerigen = produkJerigenList.find(p => p.produk_id === parseInt(currentItem.produk_jerigen_id));
    const produkKiloan = produkKiloanList.find(p => p.id === parseInt(currentItem.produk_kiloan_id));

    if (!produkJerigen || !produkKiloan) return null;

    const jumlahInput = parseFloat(currentItem.jumlah);
    if (isNaN(jumlahInput) || jumlahInput <= 0) return null;

    // KG → ML conversion
    if (produkJerigen.satuan === 'Kg' && produkKiloan.satuan === 'Ml') {
      if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
        return {
          error: `Produk "${produkJerigen.nama_produk}" belum memiliki density factor!`,
          type: 'error'
        };
      }

      const output = (jumlahInput / produkJerigen.density_kg_per_liter) * 1000;
      return {
        type: 'KG_TO_ML',
        input: jumlahInput,
        output: output,
        inputUnit: 'KG',
        outputUnit: 'ML',
        density: produkJerigen.density_kg_per_liter,
        formula: `${jumlahInput} KG ÷ ${produkJerigen.density_kg_per_liter} × 1000 = ${output.toFixed(2)} ML`
      };
    }

    // ML → KG conversion (rare)
    if (produkJerigen.satuan === 'Ml' && produkKiloan.satuan === 'Kg') {
      if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
        return {
          error: `Produk "${produkJerigen.nama_produk}" belum memiliki density factor!`,
          type: 'error'
        };
      }

      const output = (jumlahInput / 1000) * produkJerigen.density_kg_per_liter;
      return {
        type: 'ML_TO_KG',
        input: jumlahInput,
        output: output,
        inputUnit: 'ML',
        outputUnit: 'KG',
        density: produkJerigen.density_kg_per_liter,
        formula: `${jumlahInput} ML ÷ 1000 × ${produkJerigen.density_kg_per_liter} = ${output.toFixed(2)} KG`
      };
    }

    // Same unit, no conversion
    return {
      type: 'SAME_UNIT',
      input: jumlahInput,
      output: jumlahInput,
      inputUnit: produkJerigen.satuan,
      outputUnit: produkKiloan.satuan
    };
  };

  const handleAddItem = () => {
    if (!formData.cabang_id) {
      alert('❌ Pilih cabang terlebih dahulu!');
      return;
    }

    if (!currentItem.produk_jerigen_id || !currentItem.produk_kiloan_id || !currentItem.jumlah) {
      alert('Produk jerigen, produk kiloan, dan jumlah wajib diisi');
      return;
    }

    const produkJerigen = produkJerigenList.find(p => p.produk_id === parseInt(currentItem.produk_jerigen_id));
    const produkKiloan = produkKiloanList.find(p => p.id === parseInt(currentItem.produk_kiloan_id));
    
    if (!produkJerigen || !produkKiloan) {
      alert('Produk tidak ditemukan');
      return;
    }

    const jumlahInput = parseFloat(currentItem.jumlah);

    if (jumlahInput <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }

    // Validate stock
    if (jumlahInput > produkJerigen.stock) {
      alert(
        `❌ Stock ${produkJerigen.nama_produk} di cabang ${produkJerigen.cabang} tidak mencukupi!\n\n` +
        `Stock tersedia: ${produkJerigen.stock} ${produkJerigen.satuan}\n` +
        `Diminta: ${jumlahInput} ${produkJerigen.satuan}`
      );
      return;
    }

    // Check duplicate
    if (detailItems.some(item => 
      item.produk_jerigen_id === parseInt(currentItem.produk_jerigen_id) &&
      item.produk_kiloan_id === parseInt(currentItem.produk_kiloan_id)
    )) {
      alert('Kombinasi produk ini sudah ditambahkan!');
      return;
    }

    // Calculate remaining stock
    const usedStock = detailItems
      .filter(item => item.produk_jerigen_id === parseInt(currentItem.produk_jerigen_id))
      .reduce((sum, item) => sum + item.jumlah, 0);
    
    const remainingStock = produkJerigen.stock - usedStock;

    if (jumlahInput > remainingStock) {
      alert(
        `❌ Stock tidak mencukupi!\n\n` +
        `Stock ${produkJerigen.nama_produk}: ${produkJerigen.stock} ${produkJerigen.satuan}\n` +
        `Sudah digunakan: ${usedStock} ${produkJerigen.satuan}\n` +
        `Sisa: ${remainingStock} ${produkJerigen.satuan}\n` +
        `Diminta: ${jumlahInput} ${produkJerigen.satuan}`
      );
      return;
    }

    // 🆕 Calculate output based on conversion
    let jumlahOutput = jumlahInput;
    let satuanOutput = produkKiloan.satuan;
    let density = undefined;
    let conversionType = null;

    if (produkJerigen.satuan === 'Kg' && produkKiloan.satuan === 'Ml') {
      // KG → ML conversion
      if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
        alert(`❌ Produk "${produkJerigen.nama_produk}" belum memiliki density factor!\n\nSilakan update di Master Produk terlebih dahulu.`);
        return;
      }
      density = produkJerigen.density_kg_per_liter;
      jumlahOutput = (jumlahInput / density) * 1000;
      conversionType = 'KG_TO_ML';
      
      console.log(`🔄 Conversion Preview: ${jumlahInput} KG (density ${density}) → ${jumlahOutput.toFixed(2)} ML`);
    } else if (produkJerigen.satuan === 'Ml' && produkKiloan.satuan === 'Kg') {
      // ML → KG conversion
      if (!produkJerigen.density_kg_per_liter || produkJerigen.density_kg_per_liter <= 0) {
        alert(`❌ Produk "${produkJerigen.nama_produk}" belum memiliki density factor untuk konversi ML→KG!`);
        return;
      }
      density = produkJerigen.density_kg_per_liter;
      jumlahOutput = (jumlahInput / 1000) * density;
      conversionType = 'ML_TO_KG';
      
      console.log(`🔄 Conversion Preview: ${jumlahInput} ML → ${jumlahOutput.toFixed(2)} KG (density ${density})`);
    }

    const newItem: DetailItem = {
      produk_jerigen_id: parseInt(currentItem.produk_jerigen_id),
      nama_jerigen: produkJerigen.nama_produk,
      produk_kiloan_id: parseInt(currentItem.produk_kiloan_id),
      nama_kiloan: produkKiloan.nama_produk,
      jumlah: jumlahInput,
      jumlah_output: jumlahOutput, // 🆕
      satuan_input: produkJerigen.satuan, // 🆕
      satuan_output: satuanOutput, // 🆕
      density: density, // 🆕
      conversion_type: conversionType, // 🆕
      stok_jerigen: produkJerigen.stock,
      keterangan: currentItem.keterangan,
    };

    setDetailItems([...detailItems, newItem]);
    setCurrentItem({ 
      produk_jerigen_id: '', 
      produk_kiloan_id: '', 
      jumlah: '', 
      keterangan: '' 
    });
  };

  const handleRemoveItem = (index: number) => {
    setDetailItems(detailItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tanggal || !formData.cabang_id) {
      alert('Tanggal dan Cabang wajib diisi');
      return;
    }

    if (detailItems.length === 0) {
      alert('Tambahkan minimal 1 item unloading');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        tanggal: formData.tanggal,
        cabang_id: parseInt(formData.cabang_id),
        keterangan: formData.keterangan,
        items: detailItems,
      };

      const res = await fetch('/api/gudang/unloading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || '✅ Unloading berhasil!');
        onSuccess();
        onClose();
      } else {
        alert(`❌ ${json.error || 'Gagal menyimpan unloading'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalQty = () => {
    return detailItems.reduce((sum, item) => sum + item.jumlah, 0);
  };

  const getRemainingStock = (produkJerigenId: number): number => {
    const produk = produkJerigenList.find(p => p.produk_id === produkJerigenId);
    if (!produk) return 0;

    const usedStock = detailItems
      .filter(item => item.produk_jerigen_id === produkJerigenId)
      .reduce((sum, item) => sum + item.jumlah, 0);

    return produk.stock - usedStock;
  };

  // 🆕 Get conversion preview component
  const conversionPreview = getConversionPreview();

  if (!isOpen) return null;

  return (
    <SingleOverlay>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800">Menyimpan...</p>
              <p className="text-sm text-gray-600">Mohon tunggu</p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Tambah Unloading Barang</h2>
            <p className="text-xs sm:text-sm text-gray-500">Tuang madu dari jerigen ke kiloan/eceran (support konversi KG→ML)</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800 p-1">
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* INFO BOX */}
          {formData.cabang_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 text-sm mb-1">
                    Info Multi-Branch Unloading
                  </h4>
                  <p className="text-xs text-blue-800">
                    Stock jerigen akan <strong>berkurang</strong> dan stock kiloan akan <strong>bertambah</strong> di cabang:{' '}
                    <span className="font-bold">
                      {cabangList.find(c => c.id.toString() === formData.cabang_id)?.nama_cabang}
                    </span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    ⚠️ Pastikan cabang sudah benar sebelum menyimpan!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form Utama */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Tanggal Unloading <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.cabang_id}
                onChange={(e) => {
                  setFormData({ ...formData, cabang_id: e.target.value });
                  setDetailItems([]);
                  setCurrentItem({ 
                    produk_jerigen_id: '', 
                    produk_kiloan_id: '', 
                    jumlah: '', 
                    keterangan: '' 
                  });
                }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">-- Pilih Cabang --</option>
                {cabangList.map((cabang) => (
                  <option key={cabang.id} value={cabang.id}>
                    {cabang.nama_cabang}
                  </option>
                ))}
              </select>
              {!formData.cabang_id && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Pilih cabang dulu untuk melihat stock jerigen
                </p>
              )}
            </div>
          </div>

          {/* Tambah Unloading */}
          {formData.cabang_id && (
            <div className="border-t pt-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                  Tambah Item Unloading
                </span>
              </h3>
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Produk Bundles (Sumber) <span className="text-red-500">*</span>
                    </label>
                    {loadingProduk ? (
                      <div className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-100 text-gray-500">
                        Loading stock data...
                      </div>
                    ) : (
                      <select
                        value={currentItem.produk_jerigen_id}
                        onChange={(e) => {
                          const jerigenId = e.target.value;
                          const jerigenSatuan = jerigenId ?
                            produkJerigenList.find(p => p.produk_id === parseInt(jerigenId))?.satuan || '' :
                            '';

                          setCurrentItem({
                            ...currentItem,
                            produk_jerigen_id: jerigenId,
                            // Clear kiloan selection if jerigen satuan doesn't support current kiloan
                            produk_kiloan_id: jerigenSatuan.toLowerCase() !== 'ml' &&
                                            produkKiloanList.find(k => k.id.toString() === currentItem.produk_kiloan_id)?.satuan?.toLowerCase() === 'pcs' ?
                                            '' : currentItem.produk_kiloan_id
                          });

                          // ✅ UPDATE kiloan products based on jerigen satuan
                          // If jerigen has 'Ml' satuan, include PCS products in kiloan list
                          if (jerigenSatuan.toLowerCase() === 'ml') {
                            updateProdukKiloanFiltered('Ml');
                          } else if (jerigenId) {
                            // Reset to exclude PCS
                            updateProdukKiloanFiltered('');
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={loadingProduk}
                      >
                        <option value="">-- Pilih Produk Jerigen --</option>
                        {produkJerigenList.length === 0 && !loadingProduk && (
                          <option disabled>Tidak ada stock jerigen di cabang ini</option>
                        )}
                        {produkJerigenList.map((produk) => {
                          const remaining = getRemainingStock(produk.produk_id);
                          const hasMlBadge = produk.satuan.toLowerCase() === 'ml';
                          return (
                            <option
                              key={produk.produk_id}
                              value={produk.produk_id}
                              disabled={remaining <= 0}
                            >
                              {produk.nama_produk} - {produk.cabang} (Stock: {remaining.toFixed(2)} / {produk.stock.toFixed(2)} {produk.satuan})
                              {produk.density_kg_per_liter && ` [ρ=${produk.density_kg_per_liter}]`}
                              {hasMlBadge && ' 🏷️ ML (can fill PCS)'}
                            </option>
                          );
                        })}
                      </select>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      ⬇️ Stock akan berkurang (hanya tampil stock cabang terpilih)
                      {produkJerigenList.find(p => p.produk_id === parseInt(currentItem.produk_jerigen_id))?.satuan?.toLowerCase() === 'ml' &&
                       ' | 🏷️ Ini produk ML - PCS dapat dipilih sebagai tujuan'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Produk Kiloan/Eceran (Tujuan) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={currentItem.produk_kiloan_id}
                      onChange={(e) => setCurrentItem({ ...currentItem, produk_kiloan_id: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Pilih Produk Kiloan --</option>
                      {produkKiloanList.map((produk) => (
                        <option key={produk.id} value={produk.id}>
                          {produk.nama_produk} ({produk.satuan})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-indigo-600 mt-1 font-medium">
                      ⬆️ Stock akan bertambah di: {cabangList.find(c => c.id.toString() === formData.cabang_id)?.nama_cabang || 'Pilih cabang dulu'}
                    </p>
                  </div>
                </div>

                {/* 🆕 CONVERSION PREVIEW */}
                {conversionPreview && conversionPreview.type !== 'error' && conversionPreview.type !== 'SAME_UNIT' &&
                 conversionPreview.input !== undefined && conversionPreview.output !== undefined && (
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Droplets className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-cyan-900 mb-1">🔄 Konversi Otomatis</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-red-600">
                            -{conversionPreview.input.toFixed(2)} {conversionPreview.inputUnit}
                          </span>
                          <ArrowRight className="w-4 h-4 text-cyan-600" />
                          <span className="font-semibold text-green-600">
                            +{conversionPreview.output.toFixed(2)} {conversionPreview.outputUnit}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 font-mono">
                          {conversionPreview.formula}
                        </p>
                        <p className="text-xs text-cyan-700 mt-1">
                          Density: <strong>{conversionPreview.density} kg/L</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ERROR: Missing density */}
                {conversionPreview && conversionPreview.type === 'error' && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-900">❌ Density Belum Diset</p>
                        <p className="text-xs text-red-700 mt-1">
                          {conversionPreview.error}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Silakan update density di <strong>Master Produk</strong> terlebih dahulu.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Jumlah <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentItem.jumlah}
                      onChange={(e) => setCurrentItem({ ...currentItem, jumlah: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1">Keterangan</label>
                    <input
                      type="text"
                      value={currentItem.keterangan}
                      onChange={(e) => setCurrentItem({ ...currentItem, keterangan: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Catatan (opsional)"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={loadingProduk}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                  Tambah ke List
                </button>
              </div>
            </div>
          )}

          {/* List Items */}
          {detailItems.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-bold text-gray-800 mb-3 text-sm sm:text-base">
                List Items ({detailItems.length} item)
              </h3>
              
              {/* Mobile View - Cards */}
              <div className="block sm:hidden space-y-3">
                {detailItems.map((item, index) => (
                  <div key={index} className="bg-white border-2 border-indigo-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{item.nama_jerigen}</div>
                        <div className="text-xs text-gray-500">Stock: {item.stok_jerigen}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    {/* Conversion display */}
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded p-2 mb-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-700 font-semibold">
                          -{item.jumlah.toFixed(2)} {item.satuan_input}
                        </span>
                        {item.conversion_type && (
                          <ArrowRight className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      {item.density && item.conversion_type && (
                        <div className="text-xs text-gray-600 mt-1">
                          ρ = {item.density} kg/L
                        </div>
                      )}
                    </div>

                    <div className="text-center text-indigo-600 font-bold text-sm my-2">↓</div>
                    
                    <div className="text-sm font-medium text-gray-800 mb-2">{item.nama_kiloan}</div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded p-2">
                      <div className="text-sm text-green-700 font-semibold">
                        +{(item.jumlah_output || item.jumlah).toFixed(2)} {item.satuan_output}
                      </div>
                    </div>

                    {item.keterangan && (
                      <div className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2">
                        {item.keterangan}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-indigo-100">
                    <tr>
                      <th className="px-3 py-2 text-left border">Produk Jerigen</th>
                      <th className="px-3 py-2 text-center border">→</th>
                      <th className="px-3 py-2 text-left border">Produk Kiloan</th>
                      <th className="px-3 py-2 text-right border">Input → Output</th>
                      <th className="px-3 py-2 text-left border">Keterangan</th>
                      <th className="px-3 py-2 text-center border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 border">
                          <div>
                            <div className="font-medium">{item.nama_jerigen}</div>
                            <div className="text-xs text-gray-500">Stock: {item.stok_jerigen}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center border">
                          <span className="text-indigo-600 font-bold">→</span>
                        </td>
                        <td className="px-3 py-2 border font-medium">{item.nama_kiloan}</td>
                        <td className="px-3 py-2 text-right border">
                          <div className="space-y-1">
                            <div className="text-red-600 font-semibold">
                              -{item.jumlah.toFixed(2)} {item.satuan_input}
                            </div>
                            {item.conversion_type && (
                              <>
                                <div className="flex items-center justify-end gap-1">
                                  <Droplets className="w-3 h-3 text-cyan-600" />
                                  <span className="text-xs text-gray-500">
                                    ρ={item.density} kg/L
                                  </span>
                                </div>
                                <div className="text-indigo-600 font-bold">↓</div>
                              </>
                            )}
                            <div className="text-green-600 font-semibold">
                              +{(item.jumlah_output || item.jumlah).toFixed(2)} {item.satuan_output}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 border text-gray-600">{item.keterangan || '-'}</td>
                        <td className="px-3 py-2 text-center border">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-right border">Total Input:</td>
                      <td className="px-3 py-2 text-right border text-red-600">
                        {calculateTotalQty().toFixed(2)} KG/ML
                      </td>
                      <td colSpan={2} className="border"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Keterangan Umum */}
          <div>
            <label className="block text-sm font-medium mb-1">Keterangan Umum</label>
            <textarea
              value={formData.keterangan}
              onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || detailItems.length === 0 || !formData.cabang_id}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Unloading'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </SingleOverlay>
  );
}
