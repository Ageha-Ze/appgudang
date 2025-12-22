// app/persediaan/stock-opname/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Plus, Search, CheckCircle, XCircle, Clock, Eye, Trash2, X } from 'lucide-react';
import ModalTambahOpname from './ModalTambahOpname'; // Import dari file lokal
import DeleteModal from '@/components/DeleteModal';

// Modal components for approve, reject operations
function ApproveModal({ isOpen, onClose, onConfirm, itemName, itemValue }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  itemName: string;
  itemValue: string;
}) {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
        <div className="w-16 h-16 bg-green-100 border-4 border-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-600 w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Setujui Stock Opname</h3>
        <p className="text-gray-600 mb-4 text-center">
          Anda yakin ingin menyetujui {itemName} "{itemValue}"?
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Catatan Approval (Opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan catatan jika diperlukan..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 transition"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-500 text-white py-2 rounded hover:bg-green-600 transition"
          >
            Setujui
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ isOpen, onClose, onConfirm, itemName, itemValue }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  itemName: string;
  itemValue: string;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Alasan penolakan harus diisi');
      return;
    }
    onConfirm(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
        <div className="w-16 h-16 bg-red-100 border-4 border-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="text-red-600 w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Tolak Stock Opname</h3>
        <p className="text-gray-600 mb-4 text-center">
          Anda yakin ingin menolak {itemName} "{itemValue}"?
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alasan Penolakan <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            rows={3}
            required
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 transition"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600 transition"
          >
            Tolak
          </button>
        </div>
      </div>
    </div>
  );
}

interface StockOpname {
  id: number;
  tanggal: string;
  produk: {
    id: number;
    nama_produk: string;
    kode_produk: string;
    stok: number;
  };
  cabang: {
    id: number;
    nama_cabang: string;
    kode_cabang: string;
  };
  jumlah_sistem: number;
  jumlah_fisik: number;
  selisih: number;
  status: 'pending' | 'approved' | 'rejected';
  keterangan: string;
  created_at: string;
}

export default function StockOpnamePage() {
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModalTambah, setShowModalTambah] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<StockOpname | null>(null);

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentOpnameId, setCurrentOpnameId] = useState<number | null>(null);
  const [currentOpnameName, setCurrentOpnameName] = useState<string>('');

  const fetchOpnames = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/persediaan/stock-opname?page=${page}&limit=10&search=${search}&status=${statusFilter}`
      );
      const json = await res.json();

      setOpnames(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching stock opname:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchOpnames();
  }, [fetchOpnames]);

  const handleApprove = (id: number, produkName: string) => {
    setCurrentOpnameId(id);
    setCurrentOpnameName(produkName);
    setShowApproveModal(true);
  };

  const handleReject = (id: number, produkName: string) => {
    setCurrentOpnameId(id);
    setCurrentOpnameName(produkName);
    setShowRejectModal(true);
  };

  const handleDelete = (id: number, produkName: string) => {
    setCurrentOpnameId(id);
    setCurrentOpnameName(produkName);
    setShowDeleteModal(true);
  };

  const executeApprove = async (notes: string) => {
    if (!currentOpnameId) return;

    try {
      const res = await fetch(`/api/persediaan/stock-opname/${currentOpnameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          keterangan: notes || 'Approved',
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Stock opname berhasil disetujui');
        fetchOpnames();
        setShowApproveModal(false);
      } else {
        alert(json.error || 'Gagal approve');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const executeReject = async (reason: string) => {
    if (!currentOpnameId) return;

    try {
      const res = await fetch(`/api/persediaan/stock-opname/${currentOpnameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          keterangan: reason,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Stock opname ditolak');
        fetchOpnames();
        setShowRejectModal(false);
      } else {
        alert(json.error || 'Gagal reject');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  const executeDelete = async () => {
    if (!currentOpnameId) return;

    try {
      const res = await fetch(`/api/persediaan/stock-opname/${currentOpnameId}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (res.ok) {
        alert(json.message || 'Data berhasil dihapus');
        fetchOpnames();
        setShowDeleteModal(false);
      } else {
        alert(json.error || 'Gagal menghapus data');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Terjadi kesalahan');
    }
  };

  // Stats
  const stats = {
    total: opnames.length,
    pending: opnames.filter(o => o.status === 'pending').length,
    approved: opnames.filter(o => o.status === 'approved').length,
    rejected: opnames.filter(o => o.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full flex items-center gap-1">
          <Clock size={14} /> Pending
        </span>;
      case 'approved':
        return <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1">
          <CheckCircle size={14} /> Approved
        </span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full flex items-center gap-1">
          <XCircle size={14} /> Rejected
        </span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Opname</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-xs font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-800 mt-1">{stats.pending}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-xs font-medium">Approved</p>
              <p className="text-2xl font-bold text-green-800 mt-1">{stats.approved}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4 shadow-sm border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-xs font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-800 mt-1">{stats.rejected}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
  <div>
    <h3 className="text-2xl font-bold">Stock Opname</h3>
    <p className="text-purple-100 mt-1">Penghitungan dan penyesuaian stock fisik</p>
  </div>

<div className="flex-shrink-0">
    <button
      onClick={() => setShowModalTambah(true)}
      className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
    >
      <Plus size={18} className="ml-1 sm:ml-0" />
      <span className="hidden sm:inline">Tambah Opname</span>
      <span className="sm:hidden">Tambah</span>
    </button>
  </div>
</div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Filters */}
          <div className="mb-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 capitalize ${
                    statusFilter === status
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status === 'all' ? 'Semua' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Add Button */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow-md">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700">Search:</label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Cari..."
              />
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="block lg:hidden space-y-3">
            {loading ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-500 font-medium">Memuat data...</p>
                </div>
              </div>
            ) : opnames.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                <p className="text-gray-500">
                  {search || statusFilter !== 'all' ? 'Tidak ada data yang cocok' : 'Belum ada stock opname'}
                </p>
              </div>
            ) : (
              opnames.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-500">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-purple-700 truncate">{item.produk.nama_produk}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {item.produk.kode_produk} • {new Date(item.tanggal).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Gudang:</span>
                      <span className="font-medium">{item.cabang.nama_cabang}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stock Sistem:</span>
                      <span className="font-medium">{parseFloat(item.jumlah_sistem.toString()).toFixed(2)} Kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stock Fisik:</span>
                      <span className="font-medium">{parseFloat(item.jumlah_fisik.toString()).toFixed(2)} Kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selisih:</span>
                      <span className={`font-semibold text-lg ${
                        item.selisih === 0
                          ? 'text-green-600'
                          : item.selisih > 0
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {item.selisih > 0 ? '+' : ''}{parseFloat(item.selisih.toString()).toFixed(2)} Kg
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-gray-200">
                    {item.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(item.id, item.produk.nama_produk)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition text-sm"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(item.id, item.produk.nama_produk)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.produk.nama_produk)}
                          className="flex items-center justify-center gap-2 px-3 py-2 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    {item.status !== 'pending' && (
                      <>
                        <button
                          onClick={() => setSelectedOpname(item)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-sm"
                        >
                          <Eye size={16} />
                          Detail
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.produk.nama_produk)}
                          className="flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition text-sm"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tanggal</th>
                  <th className="px-6 py-4 text-left font-semibold">Produk</th>
                  <th className="px-6 py-4 text-left font-semibold">Gudang</th>
                  <th className="px-6 py-4 text-right font-semibold">Stock Sistem</th>
                  <th className="px-6 py-4 text-right font-semibold">Stock Fisik</th>
                  <th className="px-6 py-4 text-right font-semibold">Selisih</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                  <th className="px-6 py-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-500 font-medium">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : opnames.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      {search || statusFilter !== 'all' ? 'Tidak ada data yang cocok' : 'Belum ada stock opname'}
                    </td>
                  </tr>
                ) : (
                  opnames.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-purple-50 transition-colors duration-200`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-gray-800 font-medium">
                          {new Date(item.tanggal).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className="text-gray-800 font-medium block">{item.produk.nama_produk}</span>
                          <span className="text-xs text-gray-500">{item.produk.kode_produk}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{item.cabang.nama_cabang}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">
                        {parseFloat(item.jumlah_sistem.toString()).toFixed(2)} Kg
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">
                        {parseFloat(item.jumlah_fisik.toString()).toFixed(2)} Kg
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold text-lg ${
                          item.selisih === 0
                            ? 'text-green-600'
                            : item.selisih > 0
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {item.selisih > 0 ? '+' : ''}{parseFloat(item.selisih.toString()).toFixed(2)} Kg
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center space-x-2">
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id, item.produk.nama_produk)}
                                className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                title="Approve"
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleReject(item.id, item.produk.nama_produk)}
                                className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                title="Reject"
                              >
                                <XCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.produk.nama_produk)}
                                className="bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                          {item.status !== 'pending' && (
                            <>
                              <button
                                onClick={() => setSelectedOpname(item)}
                                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                title="Lihat Detail"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.produk.nama_produk)}
                                className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110"
                                title="Hapus & Reverse Stock"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ModalTambahOpname
        isOpen={showModalTambah}
        onClose={() => setShowModalTambah(false)}
        onSuccess={fetchOpnames}
      />

      {/* Approve Modal */}
      <ApproveModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={executeApprove}
        itemName="Stock Opname"
        itemValue={currentOpnameName}
      />

      {/* Reject Modal */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={executeReject}
        itemName="Stock Opname"
        itemValue={currentOpnameName}
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={executeDelete}
        itemName="Stock Opname"
        itemValue={currentOpnameName}
      />

      {/* Detail Modal (simple) */}
      {selectedOpname && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Detail Stock Opname</h3>
              <button onClick={() => setSelectedOpname(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Produk</p>
                <p className="font-medium">{selectedOpname.produk.nama_produk}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tanggal</p>
                <p className="font-medium">
                  {new Date(selectedOpname.tanggal).toLocaleDateString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getStatusBadge(selectedOpname.status)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Keterangan</p>
                <p className="font-medium">{selectedOpname.keterangan || '-'}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedOpname(null)}
              className="w-full mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
