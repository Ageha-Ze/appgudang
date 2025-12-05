'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Calendar,
  DollarSign,
  Package,
  Users,
  FileText,
  TrendingUp,
  Store,
} from 'lucide-react';

interface Pegawai {
  id: number;
  nama: string;
  jabatan?: string;
}

interface SalesTransaction {
  id: number;
  type: 'direct_sale' | 'consignment_transaction' | 'consignment_sale';
  type_label: string;
  date: string;
  customer?: string;
  store?: string;
  total: number;
  status: string;
  items_count?: number;
  transaction_id: string;
}

interface SalesSummary {
  total_transactions: number;
  total_sales_direct: number;
  total_sales_consignment: number;
  total_revenue: number;
  most_sold_product?: string;
}

export default function SalesReportPage() {
  const [selectedPegawai, setSelectedPegawai] = useState<string>('');
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [summary, setSummary] = useState<SalesSummary>({
    total_transactions: 0,
    total_sales_direct: 0,
    total_sales_consignment: 0,
    total_revenue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch pegawai list on component mount
  useEffect(() => {
    fetchPegawaiList();
  }, []);

  const fetchPegawaiList = async () => {
    try {
      const response = await fetch('/api/master/pegawai');
      const result = await response.json();

      if (result.data) {
        setPegawaiList(result.data || []);
      } else if (result.error) {
        setError(result.error);
      } else {
        setError('Failed to load employee list');
      }
    } catch (error) {
      console.error('Error fetching pegawai list:', error);
      setError('Error loading employee data');
    }
  };

  const fetchSalesData = async (pegawaiId: string) => {
    if (!pegawaiId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/laporan/sales?pegawai_id=${pegawaiId}`);
      const result = await response.json();

      if (result.success) {
        setTransactions(result.data.transactions || []);
        setSummary(result.data.summary || {
          total_transactions: 0,
          total_sales_direct: 0,
          total_sales_consignment: 0,
          total_revenue: 0,
        });
      } else {
        setError(result.error || 'Failed to load sales data');
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
      setError('Error loading sales data');
    } finally {
      setLoading(false);
    }
  };

  const handlePegawaiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pegawaiId = e.target.value;
    setSelectedPegawai(pegawaiId);

    if (pegawaiId) {
      fetchSalesData(pegawaiId);
    } else {
      setTransactions([]);
      setSummary({
        total_transactions: 0,
        total_sales_direct: 0,
        total_sales_consignment: 0,
        total_revenue: 0,
      });
    }
  };

  const exportToExcel = () => {
    // Simple CSV export for now
    if (transactions.length === 0) return;

    const headers = ['Type', 'Date', 'Customer/Store', 'Transaction ID', 'Total', 'Status'];
    const csvData = transactions.map(tx =>
      [
        tx.type_label,
        tx.date,
        tx.customer || tx.store || '-',
        tx.transaction_id,
        tx.total.toLocaleString(),
        tx.status
      ].join(',')
    );

    const csv = [headers.join(','), ...csvData].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Report by Employee</h1>
          <p className="text-gray-600 mt-1">
            View all sales transactions handled by a specific employee
          </p>
        </div>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="pegawai" className="block text-sm font-medium text-gray-700 mb-2">
              Select Employee
            </label>
            <select
              id="pegawai"
              value={selectedPegawai}
              onChange={handlePegawaiChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Choose Employee --</option>
              {pegawaiList.map(pegawai => (
                <option key={pegawai.id} value={pegawai.id}>
                  {pegawai.nama} {pegawai.jabatan && `(${pegawai.jabatan})`}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-8">
            <button
              onClick={exportToExcel}
              disabled={transactions.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {selectedPegawai && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_transactions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Direct Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rp {summary.total_sales_direct.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Store className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Consignment Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rp {summary.total_sales_consignment.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  Rp {summary.total_revenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {selectedPegawai && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading sales data...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sales transactions found for this employee.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer / Store
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.type === 'direct_sale'
                            ? 'bg-green-100 text-green-800'
                            : transaction.type === 'consignment_transaction'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {transaction.type_label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.customer || transaction.store || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {transaction.transaction_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Rp {transaction.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.status === 'Lunas' || transaction.status === 'Sudah Dibayar'
                            ? 'bg-green-100 text-green-800'
                            : transaction.status === 'Aktif'
                            ? 'bg-blue-100 text-blue-800'
                            : transaction.status === 'Belum Dibayar'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedPegawai && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Employee</h3>
          <p className="text-gray-600">
            Choose an employee from the dropdown above to view their sales performance and transaction history.
          </p>
        </div>
      )}
    </div>
  );
}
