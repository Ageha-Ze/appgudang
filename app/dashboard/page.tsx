'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { TrendingUp, DollarSign, CreditCard, BarChart3, ShoppingBag, TrendingDown, Wallet, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [selectedCabangId, setSelectedCabangId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesPeriod, setSalesPeriod] = useState<'6' | '12'>('6');

  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const response = await fetch('/api/master/cabang');
        if (!response.ok) throw new Error('Failed to fetch branches');
        const result = await response.json();
        setCabangList(result.data || []);
        if (result.data && result.data.length > 0) {
          setSelectedCabangId(result.data[0].id.toString());
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCabang();
  }, []);

  useEffect(() => {
    if (!selectedCabangId) return;
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/dashboard?cabangId=${selectedCabangId}&period=${salesPeriod}`);
        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        const data = await response.json();
        setDashboardData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [selectedCabangId, salesPeriod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-red-600 font-medium">Error: {error}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const pendapatan = dashboardData?.pendapatanBulanIni || 0;
  const hpp = dashboardData?.totalHPP || 0;
  const pengeluaran = dashboardData?.pengeluaranBulanIni || 0;
  
  const labaKotor = pendapatan - hpp;
  const marginLaba = pendapatan > 0 ? ((labaKotor / pendapatan) * 100) : 0;
  
  const rasioKasHutang = dashboardData && dashboardData.totalHutang > 0
    ? (dashboardData.kasSaatIni / dashboardData.totalHutang)
    : 0;
  const efisiensiOperasional = pendapatan > 0 ? ((pengeluaran / pendapatan) * 100) : 0;

  // Debug log
  console.log('📊 Dashboard Data:', {
    pendapatan,
    hpp,
    pengeluaran,
    labaKotor,
    marginLaba
  });

  // Pie data - only show positive values
  const pieData = [
    { name: 'HPP', value: hpp, color: '#f59e0b' },
    { name: 'Pengeluaran', value: pengeluaran, color: '#ef4444' },
    { name: 'Laba', value: labaKotor > 0 ? labaKotor : 0, color: '#10b981' },
  ].filter(item => item.value > 0);

  console.log('🥧 Pie Data:', pieData);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">

      <div className="flex-1 flex flex-col overflow-hidden">

        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
    <div className="flex-1">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1">Dashboard Analytics</h1>
      <p className="text-sm sm:text-base text-gray-600">Selamat datang kembali! Berikut ringkasan bisnis Anda hari ini.</p>
    </div>

    <div className="bg-white px-4 sm:px-5 py-3 rounded-xl shadow-sm border border-gray-200 w-full sm:w-auto sm:min-w-[240px]">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pilih Kantor</label>
      <select
        value={selectedCabangId || ''}
        onChange={(e) => setSelectedCabangId(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
      >
        {cabangList.length > 0 ? (
          cabangList.map((cabang) => (
            <option key={cabang.id} value={cabang.id}>
              {cabang.nama_cabang}
            </option>
          ))
        ) : (
          <option disabled>No branches available</option>
        )}
      </select>
    </div>
  </div>
</div>

{/* Info Banner - Tidak Ada Data Bulan Ini */}
{pendapatan === 0 && hpp === 0 && pengeluaran === 0 && (
  <div className="mb-4 sm:mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 sm:p-5">
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
      <div className="flex-shrink-0 mx-auto sm:mx-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-full flex items-center justify-center">
          <span className="text-xl sm:text-2xl">📊</span>
        </div>
      </div>
      <div className="flex-1 text-center sm:text-left">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
          Belum Ada Transaksi Bulan Ini
        </h3>
        <p className="text-xs sm:text-sm text-gray-700 mb-3">
          Dashboard menampilkan data untuk bulan <strong>{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong>. 
          Saat ini belum ada transaksi penjualan yang tercatat untuk periode ini.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <a 
            href="/transaksi/penjualan" 
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="whitespace-nowrap">Buat Transaksi Penjualan</span>
          </a>
          <a 
            href="/transaksi/konsinyasi"
            className="px-4 py-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 transition-colors text-center"
          >
            Buat Transaksi Konsinyasi
          </a>
        </div>
      </div>
    </div>
  </div>
)}

          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <MetricCard
              title="Kas Saat Ini"
              value={formatCurrency(dashboardData?.kasSaatIni || 0)}
              icon={<Wallet className="w-5 h-5" />}
              trend="+12.5%"
              trendUp={true}
              gradient="from-blue-500 to-blue-600"
            />
            <MetricCard
              title="Total Piutang"
              value={formatCurrency(dashboardData?.totalPiutang || 0)}
              icon={<CreditCard className="w-5 h-5" />}
              trend="-3.2%"
              trendUp={false}
              gradient="from-violet-500 to-violet-600"
            />
            <MetricCard
              title="Pendapatan Bulan Ini"
              value={formatCurrency(dashboardData?.pendapatanBulanIni || 0)}
              icon={<TrendingUp className="w-5 h-5" />}
              trend="+18.4%"
              trendUp={true}
              gradient="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Total Hutang"
              value={formatCurrency(dashboardData?.totalHutang || 0)}
              icon={<TrendingDown className="w-5 h-5" />}
              trend="+5.7%"
              trendUp={false}
              gradient="from-rose-500 to-rose-600"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Tren Penjualan</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Performa {salesPeriod === '6' ? '6 bulan' : '1 tahun'} terakhir
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSalesPeriod('6')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${
                      salesPeriod === '6' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    6 Bulan
                  </button>
                  <button 
                    onClick={() => setSalesPeriod('12')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${
                      salesPeriod === '12' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    1 Tahun
                  </button>
                </div>
              </div>

              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData?.salesData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart - Komposisi Keuangan */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-bold text-gray-900 mb-4">Komposisi Keuangan</h4>
              
              {pieData.length > 0 ? (
                <>
                  <div className="w-full h-[240px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-gray-700 font-medium">{item.name}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full h-[240px] flex flex-col items-center justify-center text-center px-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Package className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1">Belum Ada Data</p>
                  <p className="text-sm text-gray-500">
                    Tidak ada transaksi penjualan<br />bulan ini untuk ditampilkan
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <SummaryCard
              title="Laba Kotor"
              value={formatCurrency(labaKotor)}
              subtitle="Pendapatan - HPP"
              icon={<DollarSign className="w-5 h-5" />}
              color={labaKotor >= 0 ? "emerald" : "rose"}
              isNegative={labaKotor < 0}
            />
            <SummaryCard
              title="Margin Laba"
              value={`${marginLaba >= 0 ? '+' : ''}${marginLaba.toFixed(1)}%`}
              subtitle="Persentase keuntungan"
              icon={<BarChart3 className="w-5 h-5" />}
              color={marginLaba >= 0 ? "blue" : "rose"}
              isNegative={marginLaba < 0}
            />
            <SummaryCard
              title="Total HPP"
              value={formatCurrency(hpp)}
              subtitle="Harga pokok penjualan"
              icon={<Package className="w-5 h-5" />}
              color="amber"
              isNegative={false}
            />
          </div>

          {/* Business Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricDetailCard
              title="Rasio Kas/Hutang"
              value={`${rasioKasHutang.toFixed(2)}x`}
              description="Kemampuan membayar hutang dengan kas yang tersedia"
              status={rasioKasHutang >= 1 ? 'good' : 'warning'}
              detail={rasioKasHutang >= 1 ? 'Sangat baik' : 'Perlu perhatian'}
            />
            <MetricDetailCard
              title="Piutang/Pendapatan"
              value={`${dashboardData && dashboardData.pendapatanBulanIni > 0 ? ((dashboardData.totalPiutang / dashboardData.pendapatanBulanIni) * 100).toFixed(0) : 0}%`}
              description="Persentase piutang dari total pendapatan bulanan"
              status="neutral"
              detail="Dalam batas wajar"
            />
            <MetricDetailCard
              title="Efisiensi Operasional"
              value={`${efisiensiOperasional.toFixed(0)}%`}
              description="Rasio pengeluaran terhadap pendapatan"
              status={efisiensiOperasional < 70 ? 'good' : 'warning'}
              detail={efisiensiOperasional < 70 ? 'Efisien' : 'Perlu optimasi'}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, trendUp, gradient }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
  trendUp: boolean;
  gradient: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-5 shadow-lg text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8"></div>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
            {icon}
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${trendUp ? 'bg-white/20' : 'bg-black/20'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </div>
        </div>
        <p className="text-sm font-medium opacity-90 mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, color, isNegative }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  isNegative?: boolean;
}) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  }[color];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses} border`}>
          {icon}
        </div>
        {isNegative && (
          <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
            RUGI
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-gray-600 mb-1">{title}</h4>
      <p className={`text-3xl font-bold mb-2 ${isNegative ? 'text-rose-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function MetricDetailCard({ title, value, description, status, detail }: {
  title: string;
  value: string;
  description: string;
  status: 'good' | 'warning' | 'neutral';
  detail: string;
}) {
  const statusConfig = {
    good: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✓' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '⚠' },
    neutral: { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700', icon: 'ℹ' },
  }[status];

  return (
    <div className={`${statusConfig.bg} rounded-xl p-6 border ${statusConfig.border}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
        <span className={`text-lg`}>{statusConfig.icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className="text-xs text-gray-600 mb-3">{description}</p>
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.badge}`}>
        {detail}
      </span>
    </div>
  );
}
