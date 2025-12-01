'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home, Database, Warehouse, ShoppingCart, Package, DollarSign,
  FileText, User, Users, Truck, Briefcase, Wallet, Building,
  BoxIcon, TrendingUp, TrendingDown, Clipboard, ChevronDown,
  CreditCard, Sparkles,
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, href: '/dashboard' },
  {
    id: 'master',
    name: 'Master Data',
    icon: Database,
    submenu: [
      { id: 'user', name: 'User', icon: User, href: '/master/user' },
      { id: 'produk', name: 'Products', icon: Package, href: '/master/produk' },
      { id: 'customer', name: 'Customer', icon: Users, href: '/master/customer' },
      { id: 'suplier', name: 'Supplier', icon: Truck, href: '/master/supplier' },
      { id: 'pegawai', name: 'Officer', icon: Briefcase, href: '/master/pegawai' },
      { id: 'kas', name: 'Cash Account', icon: Wallet, href: '/master/kas' },
      { id: 'cabang', name: 'Office', icon: Building, href: '/master/cabang' },
    ],
  },
  {
    id: 'gudang',
    name: 'Storage Management',
    icon: Warehouse,
    submenu: [
      { id: 'unloading', name: 'Unload', icon: BoxIcon, href: '/gudang/unloading' },
      { id: 'produksi', name: 'Production', icon: Package, href: '/gudang/produksi' },
    ],
  },
  {
    id: 'transaksi',
    name: 'Trading',
    icon: ShoppingCart,
    submenu: [
      { id: 'pembelian-barang', name: 'Purchasing', icon: TrendingDown, href: '/transaksi/pembelian' },
      { id: 'penjualan-barang', name: 'Selling', icon: TrendingUp, href: '/transaksi/penjualan' },
      { id: 'konsinyasi', name: 'Consigment', href: '/transaksi/konsinyasi', icon: Package },
    ],
  },
  {
    id: 'persediaan',
    name: 'Inventory',
    icon: Package,
    submenu: [
      { id: 'stock-barang', name: 'Stock Control', icon: Clipboard, href: '/persediaan/stock-barang' },
      { id: 'stock-obname', name: 'Stock Opname', icon: Clipboard, href: '/persediaan/stock-opname' },
    ],
  },
  {
    id: 'keuangan',
    name: 'Finance Accounting',
    icon: DollarSign,
    submenu: [
      { id: 'hutang-pembelian', name: 'Account Payable (AC)', icon: TrendingDown, href: '/keuangan/hutang' },
      { id: 'piutang-penjualan', name: 'Account Receivable (AR)', icon: TrendingUp, href: '/keuangan/piutang' },
      { id: 'hutang-umum', name: 'Liabilities', icon: CreditCard, href: '/keuangan/hutang-umum' },
      { id: 'kas-harian', name: 'Daily Cash', icon: CreditCard, href: '/keuangan/transaksiharian' },
    ],
  },
  {
    id: 'laporan',
    name: 'Report',
    icon: FileText,
    submenu: [
      { id: 'laporan-pembelian', name: 'Purchasing', icon: FileText, href: '/laporan/pembelian' },
      { id: 'laporan-penjualan', name: 'Selling', icon: FileText, href: '/laporan/penjualan' },
      { id: 'laporan-hutang', name: 'Payable', icon: FileText, href: '/laporan/hutang' },
      { id: 'laporan-piutang', name: 'Receivable', icon: FileText, href: '/laporan/piutang' },
      { id: 'laporan-sales', name: 'Sales', icon: FileText, href: '/laporan/sales' },
      { id: 'laporan-movement', name: 'Stock Movement (FIFO)', icon: Package, href: '/laporan/laporan-movement' },
      { id: 'laporan-laba-rugi', name: 'Financial Analysis', icon: FileText, href: '/laporan/laba-rugi' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Auto-open menu if current page is in submenu
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.submenu) {
        const isActive = item.submenu.some((sub) => pathname === sub.href);
        if (isActive && !openMenus.includes(item.id)) {
          setOpenMenus((prev) => [...prev, item.id]);
        }
      }
    });
  }, [pathname]);

  const toggleMenu = (menuId: string) => {
    setOpenMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleLinkClick = () => {
    // Tutup sidebar di mobile saat klik link
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay untuk mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-72 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 text-white border-r border-white/10 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">GUDANGKU</h1>
              <p className="text-xs text-blue-200/60">Tanggal: 16.11.2025</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 h-[calc(100vh-180px)]">
          <div className="text-[10px] font-semibold text-blue-200/50 uppercase tracking-wider px-3 mb-3">
            Navigation
          </div>

          <div className="space-y-0.5">
            {menuItems.map((item) => (
              <div key={item.id}>
                {item.submenu ? (
                  <div>
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        openMenus.includes(item.id) 
                          ? 'bg-white/10 text-white' 
                          : 'text-blue-100/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-[18px] h-[18px]" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          openMenus.includes(item.id) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openMenus.includes(item.id) && (
                      <div className="mt-1 ml-6 space-y-0.5 border-l-2 border-blue-400/30 pl-3 py-1">
                        {item.submenu.map((sub) => (
                          <Link
                            key={sub.id}
                            href={sub.href}
                            onClick={handleLinkClick}
                            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                              pathname === sub.href
                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium'
                                : 'text-blue-100/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <sub.icon className="w-[14px] h-[14px]" />
                            <span>{sub.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      pathname === item.href
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium'
                        : 'text-blue-100/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-blue-200/50 text-center">
            <p className="font-medium">© 2025 Ageha-Ze</p>
            <p className="mt-1 text-blue-300/40">Version 1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}
