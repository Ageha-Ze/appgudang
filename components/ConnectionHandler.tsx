// components/ConnectionHandler.tsx
'use client';

import { useConnectionHandler } from '@/hooks/useConnectionHandler';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionHandler() {
  const { isOnline, showOfflineModal, setShowOfflineModal } = useConnectionHandler();

  if (!showOfflineModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Koneksi Terputus
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6">
          Sepertinya koneksi internet Anda terputus. Periksa koneksi Anda dan coba lagi.
        </p>

        {/* Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Status Koneksi</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Terhubung' : 'Terputus'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
          <button
            onClick={() => setShowOfflineModal(false)}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>

        {/* Auto-reconnect info */}
        {isOnline && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 text-center">
              ✓ Koneksi pulih! Halaman akan dimuat ulang otomatis...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
