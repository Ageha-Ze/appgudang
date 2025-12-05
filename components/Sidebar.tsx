'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home, Database, Warehouse, ShoppingCart, Package, DollarSign,
  FileText, User, Users, Truck, Briefcase, Wallet, Building,
  BoxIcon, TrendingUp, TrendingDown, Clipboard, ChevronDown,
  CreditCard, Sparkles, Handshake, Bell, LogOut, Settings,
  ChevronRight, ChevronLeft, X, Check,
} from 'lucide-react';
import { logoutUser } from '@/app/login/actions';



interface MenuItem {
  id: string;
  name: string;
  icon: any;
  href?: string;
  badge?: string | number;
  submenu?: MenuItem[];
}

const menuItems: MenuItem[] = [
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
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

interface Notification {
  id: string;
  type: string;
  icon: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  link: string;
  priority: string;
}

export default function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState({ name: 'Admin User', email: 'admin@gudangkita.com' });
  const [marqueeText, setMarqueeText] = useState('');

  // Fetch notification counts for badges
  const fetchNotificationCounts = async () => {
    try {
      const response = await fetch('/api/notifications');
      const result = await response.json();

      if (result.success) {
        const counts: Record<string, number> = {};

        // Count notifications by type
        result.data.forEach((notification: any) => {
          const id = notification.id.split('-')[0];
          counts[id] = (counts[id] || 0) + 1;
        });

        // Map notification types to sidebar menu items
        const mappedCounts: Record<string, number> = {};

        // Dashboard: Total unread notifications
        mappedCounts['dashboard'] = result.data.filter((n: any) => !n.isRead).length;

        // Gudang/Produksi: Pending stock opname
        mappedCounts['gudang-produksi'] = counts['opname'] || 0;

        // Persediaan: Low stock alerts
        mappedCounts['persediaan'] = counts['stock'] || 0;

        // Keuangan/Hutang: Upcoming debt payments
        mappedCounts['keuangan-hutang'] = counts['hutang'] || 0;

        // Keuangan/Piutang: Upcoming receivables
        mappedCounts['keuangan-piutang'] = counts['piutang'] || 0;

        // Transaksi/Pembelian: Pending purchase receipts
        mappedCounts['transaksi-pembelian'] = counts['pembelian'] || 0;

        setBadgeCounts(mappedCounts);
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  // Update marquee text
  useEffect(() => {
    const updateMarquee = () => {
      const now = new Date();
      
      const hour = now.getHours();
      let greeting = '';
      if (hour >= 5 && hour < 12) greeting = 'pagi';
      else if (hour >= 12 && hour < 15) greeting = 'siang';
      else if (hour >= 15 && hour < 18) greeting = 'sore';
      else greeting = 'malam';
      
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const date = `${day}/${month}/${year}`;
      
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const time = `${hours}:${minutes}`;
      
      setMarqueeText(
        `Selamat ${greeting}, ${date} ${time} WIB`
      );
    };
    
    updateMarquee();
    const interval = setInterval(updateMarquee, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Fetch badge counts on mount and periodically
  useEffect(() => {
    fetchNotificationCounts();
    const interval = setInterval(fetchNotificationCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleMenu = (menuId: string) => {
    setOpenMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleLogout = async () => {
    try {
      // Panggil server action untuk hapus cookie
      await logoutUser();

      // Clear localStorage jika ada
      localStorage.clear();
      sessionStorage.clear();

      // Hard redirect ke login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, isRead: true } : notif
      )
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white shadow-xl border-r border-gray-200 z-50 transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-80' : 'w-20'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            {isExpanded && (
              <div className="animate-fade-in">
                <h1 className="text-lg font-bold text-gray-900">GUDANG KITA</h1>
                <p className="text-xs text-gray-500">Warehouse Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Marquee Text */}
        <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
          {isExpanded ? (
            <p className="text-xs font-medium text-gray-700 text-center">
              {marqueeText}
            </p>
          ) : (
            <p className="text-[10px] font-medium text-gray-700 text-center leading-tight">
              {marqueeText.split(',')[0]}
            </p>
          )}
        </div>

        {/* Toggle Button - Positioned below header */}
        <div className="px-3 py-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 flex items-center justify-center"
            title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isExpanded ? (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-4">
            {isExpanded && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Navigation
              </p>
            )}
          </div>

          <div className="space-y-1 px-3">
            {menuItems.map((item) => (
              <div key={item.id}>
                {item.submenu ? (
                  <div>
                    {isExpanded ? (
                      <button
                        onClick={() => toggleMenu(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 ${
                          openMenus.includes(item.id)
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            openMenus.includes(item.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsExpanded(true)}
                        className="w-full flex items-center justify-center px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                      </button>
                    )}

                    {openMenus.includes(item.id) && isExpanded && (
                      <div className="mt-2 ml-8 space-y-1">
                        {item.submenu.map((sub) => (
                          sub.href ? (
                            <Link
                              key={sub.id}
                              href={sub.href}
                              className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                                pathname === sub.href
                                  ? 'bg-blue-500 text-white font-medium'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <sub.icon className="w-4 h-4" />
                                <span className="truncate">{sub.name}</span>
                              </div>
                              {(() => {
                                let badgeCount = 0;
                                if (item.id === 'gudang' && sub.id === 'produksi') {
                                  badgeCount = badgeCounts['gudang-produksi'] || 0;
                                } else if (item.id === 'persediaan') {
                                  badgeCount = badgeCounts['persediaan'] || 0;
                                } else if (item.id === 'keuangan' && sub.id === 'hutang-pembelian') {
                                  badgeCount = badgeCounts['keuangan-hutang'] || 0;
                                } else if (item.id === 'keuangan' && sub.id === 'piutang-penjualan') {
                                  badgeCount = badgeCounts['keuangan-piutang'] || 0;
                                } else if (item.id === 'transaksi' && sub.id === 'pembelian-barang') {
                                  badgeCount = badgeCounts['transaksi-pembelian'] || 0;
                                }

                                return badgeCount > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse min-w-[20px] text-center">
                                    {badgeCount > 9 ? '9+' : badgeCount}
                                  </span>
                                ) : null;
                              })()}
                            </Link>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                ) : item.href ? (
                  isExpanded ? (
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 ${
                        pathname === item.href
                          ? 'bg-blue-500 text-white font-medium border border-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </div>
                      {(() => {
                        const badgeCount = badgeCounts[item.id] || 0;
                        return badgeCount > 0 ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse min-w-[20px] text-center">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        ) : null;
                      })()}
                    </Link>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center justify-center px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                    </Link>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </nav>

        {/* Notifications Section */}
        <div className="px-3 mb-4">
          {isExpanded ? (
            <>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <span className="text-sm font-medium">Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full animate-pulse min-w-[20px] text-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-all duration-200 ${
                        notification.isRead
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notification.time}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <button
                            onClick={() => markNotificationAsRead(notification.id)}
                            className="ml-2 p-1 text-blue-600 hover:text-blue-800"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No notifications
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="w-full flex items-center justify-center px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
          )}
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-t border-gray-100">
          {isExpanded ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop blur overlay when sidebar is expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
        ></div>
      )}
    </>
  );
}
