'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Truck, Building2, Mail } from 'lucide-react';
import { SuplierData } from '@/types/suplier';
import SuplierModal from './SuplierModal';
import DeleteModal from '@/components/DeleteModal';

export default function SuplierPage() {
  const [supliers, setSupliers] = useState<SuplierData[]>([]);
  const [filteredData, setFilteredData] = useState<SuplierData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSuplier, setSelectedSuplier] = useState<SuplierData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuplierData | null>(null);

  const itemsPerPage = 10;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/master/supplier');
      const result = await response.json();
      if (result.data) {
        setSupliers(result.data);
        setFilteredData(result.data);
      }
    } catch (error) {
      console.error('Error loading supliers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Search function
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredData(supliers);
      setCurrentPage(1);
    } else {
      const filtered = supliers.filter((suplier) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          suplier.nama.toLowerCase().includes(searchLower) ||
          suplier.alamat.toLowerCase().includes(searchLower) ||
          suplier.no_telp.toLowerCase().includes(searchLower) ||
          (suplier.email?.toLowerCase() ?? '').includes(searchLower) ||
          (suplier.cabang?.nama_cabang?.toLowerCase() ?? '').includes(searchLower)
        );
      });
      setFilteredData(filtered);
      setCurrentPage(1);
    }
  }, [searchTerm, supliers]);

  // Pagination
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
    setSelectedSuplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (suplier: SuplierData) => {
    setSelectedSuplier(suplier);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (suplier: SuplierData) => {
    setDeleteTarget(suplier);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try {
        await fetch(`/api/master/supplier?id=${deleteTarget.id}`, {
          method: 'DELETE',
        });
        setIsDeleteOpen(false);
        setDeleteTarget(null);
        fetchData();
      } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('Terjadi kesalahan saat menghapus supplier');
      }
    }
  };

  // Stats calculations
  const totalSupliers = supliers.length;
  const activeBranches = new Set(supliers.map(s => s.cabang_id)).size;
  const withEmail = supliers.filter(s => s.email).length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Stats Cards - Mini Version */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Suplier</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalSupliers}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <Truck className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Cabang Aktif</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeBranches}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-4 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium">Dengan Email</p>
              <p className="text-2xl font-bold mt-1">{withEmail}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">Master Data Suplier</h3>
              <p className="text-blue-100 mt-1">Manage suppliers efficiently</p>
            </div>
            <button
              onClick={handleAdd}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <Plus size={20} className="mr-2" />
              Tambah Suplier
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Search and Info */}
          <div className="mb-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} data
            </div>
            <div className="relative w-80">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search suppliers..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 shadow-sm hover:shadow-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
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
              currentData.map((suplier, idx) => (
                <div key={suplier.id} className="bg-gradient-to-br from-blue-400 via-purple-500 to-indigo-600 rounded-2xl shadow-xl p-5 text-white relative overflow-hidden">
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
                        <p className="text-xs text-blue-100 mb-1">🏢 Kode Suplier</p>
                        <p className="font-mono text-base font-bold">SPL-{String(suplier.id).padStart(3, '0')}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {suplier.nama.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Suplier Info */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🚛</span>
                        <div className="flex-1">
                          <p className="text-xs text-blue-100">Nama Suplier</p>
                          <p className="text-sm font-semibold">{suplier.nama}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="text-lg">📍</span>
                        <div className="flex-1">
                          <p className="text-xs text-blue-100">Alamat</p>
                          <p className="text-sm font-semibold line-clamp-2">{suplier.alamat}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📞</span>
                          <div>
                            <p className="text-xs text-blue-100">No. Telp</p>
                            <p className="text-sm font-semibold">{suplier.no_telp}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-base">🏢</span>
                          <div>
                            <p className="text-xs text-blue-100">Kantor</p>
                            <p className="text-sm font-semibold">{suplier.cabang?.nama_cabang || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/20 my-4"></div>

                    {/* Email */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base">✉️</span>
                      <div>
                        <p className="text-xs text-blue-100">Email</p>
                        <p className="text-sm font-semibold">{suplier.email || '-'}</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(suplier)}
                        className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-3 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 border border-white/30"
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(suplier)}
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
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Kode Suplier</th>
                  <th className="px-6 py-4 text-left font-semibold">Nama Suplier</th>
                  <th className="px-6 py-4 text-left font-semibold">Alamat</th>
                  <th className="px-6 py-4 text-left font-semibold">No Telp</th>
                  <th className="px-6 py-4 text-left font-semibold">Email</th>
                  <th className="px-6 py-4 text-left font-semibold">Kantor</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : currentData.length > 0 ? (
                  currentData.map((suplier, idx) => (
                    <tr
                      key={suplier.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-blue-50 transition-colors duration-200`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {suplier.nama.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-mono text-sm text-gray-800 font-semibold">
                            SPL-{String(suplier.id).padStart(3, '0')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-800 font-medium">{suplier.nama}</td>
                      <td className="px-6 py-4 text-gray-700 text-sm">{suplier.alamat}</td>
                      <td className="px-6 py-4 text-gray-700 font-mono text-sm">{suplier.no_telp}</td>
                      <td className="px-6 py-4 text-gray-700 text-sm">
                        {suplier.email || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {suplier.cabang ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            <Building2 className="w-3.5 h-3.5" />
                            {suplier.cabang.nama_cabang}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleEdit(suplier)}
                            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(suplier)}
                            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'Tidak ada data yang cocok dengan pencarian' : 'Belum ada data'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredData.length > 0 && totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>

              {getPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    currentPage === page
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SuplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        suplier={selectedSuplier}
        onSuccess={fetchData}
      />

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemName="Suplier"
        itemValue={deleteTarget?.nama || ''}
      />
    </div>
  );
}
