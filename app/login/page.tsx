'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from './actions';
import { Eye, EyeOff, Lock, User, Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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

    setIsLoading(true);
    setError('');

    const result = await loginUser(formData.username, formData.password);

    if (result.success) {
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

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      
      {/* Background Gradient - Always Visible */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 lg:hidden">
        <div className="absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Login Form Container */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        
        {/* Glass Card for Mobile */}
        <div className="w-full max-w-md bg-white/95 lg:bg-white backdrop-blur-xl rounded-2xl shadow-2xl p-8 lg:p-0 lg:shadow-none lg:backdrop-blur-none">
          
          {/* Logo & Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">GUDANG KITA</h1>
                <p className="text-sm text-gray-500">Warehouse Management</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back!
            </h2>
            <p className="text-gray-600">
              Sign in to continue to your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r animate-shake">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            
            {/* Username Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your username"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder-gray-400 transition-all duration-200
                           text-gray-900 bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           placeholder-gray-400 transition-all duration-200
                           text-gray-900 bg-white"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </button>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 
                       hover:from-blue-700 hover:to-indigo-700
                       text-white font-semibold rounded-lg shadow-lg
                       transform transition-all duration-200 hover:scale-[1.02] active:scale-95
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Feeling Great?{' '}
              <button className="font-semibold text-blue-600 hover:text-blue-500">
                Don't forget to order
              </button>
            </p>
          </div>

        </div>
      </div>

      {/* Right Side - Illustration/Background - Desktop Only */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="relative flex flex-col justify-center items-center text-white p-12 z-10">
          <div className="max-w-md text-center">
            <div className="mb-8">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-lg rounded-3xl mx-auto mb-6 flex items-center justify-center border border-white/30 shadow-2xl">
                <Building2 className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold mb-4">
              Manage Your Inventory
            </h2>
            <p className="text-lg text-blue-100 leading-relaxed">
              Streamline your warehouse operations with our comprehensive inventory 
              and sales management system. Track stock, process orders, and grow your business.
            </p>

            {/* Features */}
            <div className="mt-12 grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <span className="text-2xl">📦</span>
                <span className="text-sm font-medium">Real-time Inventory Tracking</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <span className="text-2xl">📊</span>
                <span className="text-sm font-medium">Stock Analytics & Reports</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <span className="text-2xl">🔄</span>
                <span className="text-sm font-medium">Automated Stock Management</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 320" className="w-full">
            <path fill="rgba(255,255,255,0.05)" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,106.7C1248,96,1344,96,1392,96L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </div>
    </div>
  );
}