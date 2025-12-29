'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from './actions';
import { useUser } from '@/contexts/UserContext';
import { useConnectionHandler } from '@/hooks/useConnectionHandler';
import { Eye, EyeOff, Lock, User, Building2, Package, TrendingUp, BarChart3, ArrowRight, Activity, DollarSign, Boxes, Receipt, CreditCard, CheckCircle, AlertTriangle, Award, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const { isOnline } = useConnectionHandler();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!formData.username || !formData.password) {
      setError('Username dan password harus diisi');
      return;
    }

    // Check connection status before attempting login
    if (!isOnline) {
      setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await loginUser(formData.username, formData.password);

    if (result.success) {

      // Refresh user context sebelum redirect
      await refreshUser();

      router.push('/dashboard');
    } else {
      setError(result.error || 'Login gagal');
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  const [isLogoPulsing, setIsLogoPulsing] = useState(false);

  useEffect(() => {
    const logoInterval = setInterval(() => {
      setIsLogoPulsing(true);
      setTimeout(() => setIsLogoPulsing(false), 1000);
    }, 12000);

    return () => clearInterval(logoInterval);
  }, []);

  return (
    <div className="min-h-screen flex relative bg-gray-50">
      {/* Clean Professional Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-slate-50"></div>

      {/* Login Form Container */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative z-10">
        <div className="w-full max-w-lg">
          {/* Logo Section with Animation */}
          <div className="mb-8 text-center">
            {/* Animated Logo */}
            <div className="relative inline-block mb-6">
              <div className={`w-20 h-20 bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl transform transition-all duration-1000 ${isLogoPulsing ? 'scale-110 rotate-12' : 'scale-100 rotate-0'} hover:scale-110 hover:rotate-12 cursor-pointer relative overflow-hidden`}>

                {/* Animated Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-3xl animate-pulse"></div>

                {/* Main Icon */}
                <Building2 className="w-10 h-10 text-white relative z-10" />
              </div>
            </div>

            {/* Company Name with Gradient */}
            <div className="mb-6">
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 bg-clip-text text-transparent mb-2 animate-fade-in-up">
                GUDANG KITA
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium animate-fade-in-up animation-delay-300">
                Warehouse Management System
              </p>
            </div>

            {/* Welcome Message with Animation */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-3 animate-fade-in-up animation-delay-500">
                Welcome Back! <span className="animate-wave inline-block">👋</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg animate-fade-in-up animation-delay-700">
                Sign in to access your warehouse dashboard
              </p>
            </div>
          </div>

          {/* Glass Card Container */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-fade-in-up animation-delay-1000">

            {/* Error Message with Animation */}
            {error && (
              <div className="m-6 mb-0 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 text-red-700 rounded-r-xl animate-slide-in-right dark:from-red-900/20 dark:to-pink-900/20 dark:text-red-300">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Success Animation Placeholder */}
            {!error && (
              <div className="h-2 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 animate-gradient-x"></div>
            )}

            <div className="p-8 sm:p-10">

              {/* Form with Smooth Animations */}
              <div className="space-y-6">

                {/* Username Field */}
                <div className="animate-fade-in-up animation-delay-1000">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-all duration-300 group-focus-within:scale-110" />
                    </div>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter your username"
                      className="block w-full pl-12 pr-4 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-2xl
                               focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-700
                               placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300
                               text-gray-900 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md
                               disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                      disabled={isLoading}
                    />

                    {/* Animated Focus Border */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-focus-within:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

                {/* Password Field */}
                <div className="animate-fade-in-up animation-delay-1200">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-500" />
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-all duration-300 group-focus-within:scale-110" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onKeyDown={handleKeyPress}
                      placeholder="Enter your password"
                      className="block w-full pl-12 pr-12 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-2xl
                               focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white dark:focus:bg-gray-700
                               placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300
                               text-gray-900 dark:text-white hover:border-purple-300 dark:hover:border-purple-500 hover:shadow-md
                               disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:scale-110 transition-transform duration-200"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </button>

                    {/* Animated Focus Border */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-focus-within:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
                  </div>
                </div>

               

                {/* Login Button with Advanced Animation */}
                <div className="animate-fade-in-up animation-delay-1600">
                  <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="group relative w-full py-4 px-6 font-bold text-white rounded-2xl overflow-hidden transform transition-all duration-300 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
                  >
                    {/* Animated Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 group-hover:from-blue-500 group-hover:via-cyan-500 group-hover:to-emerald-500 transition-all duration-500"></div>

                    {/* Animated Border */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-400 to-blue-500 opacity-0 group-hover:opacity-30 transition-opacity duration-300 p-0.5">
                      <div className="bg-transparent rounded-2xl"></div>
                    </div>

                    {/* Glowing Border */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-emerald-400 opacity-0 group-hover:opacity-20 blur-sm transition-opacity duration-300 -z-10"></div>

                    {/* Content */}
                    <div className="relative flex items-center justify-center gap-3">
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          <span className="animate-pulse">Signing you in...</span>
                        </>
                      ) : (
                        <>
                          <span className="transform group-hover:translate-x-1 transition-transform duration-200">Sign In</span>
                          <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-200 opacity-70 group-hover:opacity-100" />
                        </>
                      )}
                    </div>

                  </button>
                </div>

              </div>

              {/* Footer */}
              <div className="mt-8 text-center animate-fade-in-up animation-delay-1800">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Shield className="w-4 h-4" />
                  <span>Your data is secured with enterprise-grade security</span>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Stats */}
          <div className="mt-8 text-center animate-fade-in-up animation-delay-2000">
            <div className="flex justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>+25% Productivity</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>100% Secure</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4" />
                <span>99.9% Uptime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Interactive Dashboard Preview */}
      <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d" 
            alt="Warehouse Background"
            className="w-full h-full object-cover"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 via-cyan-600/90 to-emerald-600/90"></div>
        </div>
        
        {/* Dynamic Background */}
        <div className="absolute inset-0">
          {/* Moving Waves */}
          <div className="absolute inset-0 opacity-20">
            <svg viewBox="0 0 1200 1200" className="w-full h-full animate-wave-1">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
                  <stop offset="50%" style={{ stopColor: 'rgba(255,255,255,0.3)' }} />
                  <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.1)' }} />
                </linearGradient>
              </defs>
              <path fill="url(#waveGradient)" d="M0,600 C300,700 600,500 900,600 C1100,650 1200,600 1200,600 L1200,1200 L0,1200 Z"></path>
            </svg>
            <svg viewBox="0 0 1200 1200" className="w-full h-full animate-wave-2">
              <path fill="rgba(255,255,255,0.05)" d="M0,700 C300,600 600,800 900,700 C1100,750 1200,700 1200,700 L1200,1200 L0,1200 Z"></path>
            </svg>
          </div>

          {/* Dashboard Feature Cards */}
          <div className="absolute inset-0 p-12 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">

              {/* Transaksi Pembelian Card */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-cyan-400/30 rounded-xl flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-cyan-200 bg-cyan-500/20 px-2 py-1 rounded-full">PEMBELIAN</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">Purchase</div>
                <div className="text-sm text-white/80">Transaction Management</div>
                <div className="flex items-center mt-3 text-xs text-emerald-300">
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Kelola pembelian & supplier
                </div>
              </div>

              {/* Persediaan/Stok Card */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-400/30 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-200 bg-emerald-500/20 px-2 py-1 rounded-full">PERSEDIAAN</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">Inventory</div>
                <div className="text-sm text-white/80">Stock Management</div>
                <div className="flex items-center mt-3 text-xs text-cyan-300">
                  <ArrowRight className="w-3 h-3 mr-1" />
                 Pantau stok & perpindahan barang
                </div>
              </div>

              {/* Keuangan Card */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-purple-400/30 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-purple-200 bg-purple-500/20 px-2 py-1 rounded-full">KEUANGAN</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">Finance</div>
                <div className="text-sm text-white/80">Cash & Accounting</div>
                <div className="flex items-center mt-3 text-xs text-amber-300">
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Kelola kas, biaya & laporan keuangan
                </div>
              </div>

              {/* Gudang Card */}
              <div className="bg-white/15 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-400/30 rounded-xl flex items-center justify-center">
                    <Boxes className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-blue-200 bg-blue-500/20 px-2 py-1 rounded-full">GUDANG</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">Warehouse</div>
                <div className="text-sm text-white/80">Production & Storage</div>
                <div className="flex items-center mt-3 text-xs text-blue-300">
                  <ArrowRight className="w-3 h-3 mr-1" />
                  Produksi & kontrol penyimpanan
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
