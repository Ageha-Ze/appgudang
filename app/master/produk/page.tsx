'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Search, Package, ShoppingCart, TrendingUp, Filter, Download } from 'lucide-react';
import { ProdukData } from '@/types/produk';
import ProdukModal from './ProdukModal';
import DeleteModal from '@/components/DeleteModal';

export default function ProdukPage() {
  const [products, setProducts] = useState<ProdukData[]>([]);
  const [filteredData, setFilteredData] = useState<ProdukData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduk, setSelectedProduk] = useState<ProdukData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdukData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsPerPage = 8;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
const response = await fetch('/api/master/produk');
const result = await response.json();
      if (result.success) {
        setProducts(result.data || []);
        setFilteredData(result.data || []);
      } else {
        let errorMessage = 'Gagal memuat data produk';
        if (result.error?.includes('authentication') || result.error?.includes('401')) {
          errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
        } else if (result.error?.includes('authorization') || result.error?.includes('403')) {
          errorMessage = 'Anda tidak memiliki akses untuk melihat data produk.';
        } else if (result.error?.includes('500')) {
          errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
        } else if (result.error) {
          errorMessage += ': ' + result.error;
        }
        setError(errorMessage);
        setProducts([]);
        setFilteredData([]);
      }
    } catch (error: any) {
      console.error('Error loading products:', error);
      let errorMessage = 'Terjadi kesalahan saat memuat data. Silakan periksa koneksi internet Anda.';
      if (error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Koneksi internet bermasalah. Tidak dapat memuat data produk.';
      }
      setError(errorMessage);
      setProducts([]);
      setFilteredData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredData(products);
      setCurrentPage(1);
    } else {
      const filtered = products.filter((produk) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          (produk.kode_produk?.toLowerCase() ?? '').includes(searchLower) ||
          produk.nama_produk.toLowerCase().includes(searchLower) ||
          produk.satuan.toLowerCase().includes(searchLower)
        );
      });
      setFilteredData(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, products]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handleAdd = () => {
    setSelectedProduk(null);
    setIsModalOpen(true);
  };

  const handleEdit = (produk: ProdukData) => {
    setSelectedProduk(produk);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (produk: ProdukData) => {
    setDeleteTarget(produk);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      setIsLoading(true);
      setError(null);

      try {
const response = await fetch(`/api/master/produk?id=${deleteTarget.id}`, {
  method: 'DELETE'
});
const result = await response.json();
        if (result.success) {
          setIsDeleteOpen(false);
          setDeleteTarget(null);

          // Success notification
          const successDiv = document.createElement('div');
          successDiv.className = 'fixed top-4 right-4 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3';
          successDiv.innerHTML = `
            <span class="text-green-600">✅</span>
            <div>
              <p class="font-semibold">Produk Dihapus!</p>
              <p class="text-sm">Produk <strong>${deleteTarget.nama_produk}</strong> telah berhasil dihapus.</p>
            </div>
            <button onclick="this.parentElement.remove()" class="text-green-700 hover:text-green-900 font-bold">×</button>
          `;
          document.body.appendChild(successDiv);
          setTimeout(() => successDiv.remove(), 5000);

          await fetchData();
        } else {
          let errorMessage = 'Gagal menghapus produk';

          if (result.error?.includes('authentication') || result.error?.includes('401')) {
            errorMessage = 'Sesi login telah berakhir. Silakan login kembali.';
          } else if (result.error?.includes('authorization') || result.error?.includes('403')) {
            errorMessage = 'Anda tidak memiliki akses untuk menghapus produk.';
          } else if (result.error?.includes('reference') || result.error?.includes('still in use')) {
            errorMessage = 'Produk tidak dapat dihapus karena masih digunakan dalam transaksi.';
          } else if (result.error?.includes('500')) {
            errorMessage = 'Server mengalami masalah. Silakan coba lagi dalam beberapa saat.';
          } else if (result.error) {
            errorMessage += ': ' + result.error;
          }

          setError(errorMessage);
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }
      } catch (error: any) {
        console.error('Error deleting product:', error);
        const errorMessage = error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED') ?
          'Koneksi internet bermasalah. Produk tidak dapat dihapus.' :
          'Terjadi kesalahan saat menghapus produk. Silakan coba lagi.';
        setError(errorMessage);
        setIsDeleteOpen(false);
        setDeleteTarget(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const totalProduk = products.length;
  const totalStok = products.reduce((sum, p) => sum + parseFloat(p.stok.toString()), 0);
  const produkJerigen = products.filter(p => p.is_jerigen).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Produk</h1>
            <p className="text-sm text-gray-600 mt-1">Kelola data produk dan inventori</p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm font-medium"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Tambah Produk</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg shadow-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100 font-medium">Total Produk</p>
                <p className="text-2xl font-bold text-white mt-1">{totalProduk}</p>
                <p className="text-xs text-blue-100 mt-1">Produk terdaftar</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 shadow-lg shadow-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-100 font-medium">Total Stok</p>
                <p className="text-2xl font-bold text-white mt-1">{totalStok.toFixed(0)}</p>
                <p className="text-xs text-emerald-100 mt-1">Unit tersedia</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg shadow-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-100 font-medium">Produk Bundles</p>
                <p className="text-2xl font-bold text-white mt-1">{produkJerigen}</p>
                <p className="text-xs text-purple-100 mt-1">Kemasan besar</p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari kode, nama produk, atau satuan..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block lg:hidden space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Memuat data...</p>
              </div>
            ) : currentData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data'}
              </div>
            ) : (
              currentData.map((produk, idx) => (
                <div key={produk.id} className="bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
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
                        <p className="text-xs text-blue-100 mb-1">📦 Kode Produk</p>
                        <p className="font-mono text-base font-bold">{produk.kode_produk ?? `PRD${String(produk.id).padStart(4, '0')}`}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {produk.nama_produk.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🛍️</span>
                        <div className="flex-1">
                          <p className="text-xs text-blue-100">Nama Produk</p>
                          <p className="text-sm font-semibold">{produk.nama_produk}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-base">💰</span>
                          <div>
                            <p className="text-xs text-blue-100">Harga</p>
                            <p className="text-sm font-semibold">{formatCurrency(produk.harga)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-base">📊</span>
                          <div>
                            <p className="text-xs text-blue-100">Stok</p>
                            <p className="text-sm font-semibold">{parseFloat(produk.stok.toString()).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🏷️</span>
                          <div>
                            <p className="text-xs text-blue-100">Satuan</p>
                            <p className="text-sm font-semibold">{produk.satuan}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-base">🛢️</span>
                          <div>
                            <p className="text-xs text-blue-100">Jerigen</p>
                            <p className="text-sm font-semibold">{produk.is_jerigen ? 'Ya' : 'Tidak'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-4"></div>

                    {/* HPP */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">💵</span>
                      <div>
                        <p className="text-xs text-blue-100">HPP</p>
                        <p className="text-sm font-semibold">{produk.hpp ? formatCurrency(produk.hpp) : '-'}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(produk)}
                        className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(produk)}
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

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Harga
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    HPP
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Satuan
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jerigen
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-900 font-semibold">
                            {searchTerm ? 'Tidak ada hasil' : 'Belum ada data produk'}
                          </p>
                          <p className="text-gray-500 text-sm mt-1">
                            {searchTerm 
                              ? 'Coba gunakan kata kunci lain' 
                              : 'Klik tombol "Tambah Produk" untuk membuat produk baru'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentData.map((produk) => (
                    <tr key={produk.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                            {produk.nama_produk.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {produk.nama_produk}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {produk.kode_produk ?? `PRD${String(produk.id).padStart(4, '0')}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(produk.harga)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-gray-600">
                          {produk.hpp ? formatCurrency(produk.hpp) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {parseFloat(produk.stok.toString()).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200">
                          {produk.satuan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {produk.is_jerigen ? (
                            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Check size={14} className="text-emerald-600" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                              <X size={14} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(produk)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(produk)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-medium text-gray-900">{Math.min(endIndex, filteredData.length)}</span> of{' '}
                  <span className="font-medium text-gray-900">{filteredData.length}</span> results
                </p>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer for single page */}
          {filteredData.length > 0 && totalPages <= 1 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/50">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">{filteredData.length}</span> of{' '}
                <span className="font-medium text-gray-900">{products.length}</span> products
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Modals */}
      <ProdukModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        produk={selectedProduk}
        onSuccess={fetchData}
      />

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName="Produk"
        itemValue={deleteTarget?.nama_produk || ''}
      />
    </div>
  );
}
