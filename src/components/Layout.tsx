import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  PieChart, 
  Target, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Wallet,
  Menu,
  X,
  CreditCard,
  Sparkles,
  Bot
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

export interface NavItem {
  path: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    groupName: 'Ringkasan',
    items: [
      { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    groupName: 'Pembukuan & Kas',
    items: [
      { path: '/cash-bank', name: 'Kas & Bank', icon: CreditCard },
      { path: '/journal', name: 'Jurnal Umum', icon: FileText },
      { path: '/ledger', name: 'Buku Besar', icon: Wallet },
      { path: '/coa', name: 'Bagan Akun (COA)', icon: BookOpen },
    ]
  },
  {
    groupName: 'Laporan & Anggaran',
    items: [
      { path: '/reports', name: 'Laporan Keuangan', icon: PieChart },
      { path: '/budget', name: 'Kontrol Anggaran', icon: Target },
      { path: '/calendar', name: 'Jadwal Pembayaran', icon: CalendarIcon },
    ]
  },
  {
    groupName: 'Agentic AI & Otomasi',
    items: [
      { path: '/mcp', name: 'Agentic AI & MCP', icon: Sparkles, badge: 'MCP' },
    ]
  },
  {
    groupName: 'Sistem',
    items: [
      { path: '/settings', name: 'Pengaturan Sistem', icon: SettingsIcon },
    ]
  }
];

export const allNavItems = navGroups.flatMap(g => g.items);

import { useNotifications } from '../hooks/useNotifications';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const { notifications } = useNotifications();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const currentPageTitle = allNavItems.find(i => i.path === location.pathname)?.name || 'Lentera Accounting';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 shrink-0 border-r border-slate-800">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <span className="text-white font-bold text-sm tracking-tighter">LP</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight block leading-tight">Lentera</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">Cloud Accounting</span>
            </div>
          </div>
        </div>
        
        {/* Grouped Sidebar Menu */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.groupName} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 tracking-wider">
                {group.groupName}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 group",
                    isActive 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon className="w-4 h-4 opacity-80 group-hover:opacity-100 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono text-amber-400/90 font-medium shrink-0 tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3 px-2 py-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center overflow-hidden shrink-0">
               {user?.photoURL ? <img src={user.photoURL} alt="avatar" /> : <span className="text-blue-400 text-xs font-bold uppercase">{user?.displayName?.substring(0, 2) || 'AD'}</span>}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate leading-none mb-1">{user?.displayName || 'Administrator'}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Financial Admin</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white border-none h-8 px-2.5 text-xs font-medium"
            onClick={logout}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="w-5 h-5 text-slate-600" />
              </Button>
            </div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">
                {currentPageTitle}
              </h1>
              <span className="hidden sm:inline text-xs text-slate-400 font-medium">
                · SAK ETAP Compliant
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 relative">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="relative p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
              title="Notifikasi Sistem"
              aria-label="Notifikasi"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative selection:bg-blue-100 selection:text-blue-900">
           <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {children}
            </motion.div>
           </div>
        </div>

        {/* Quiet Professional Footer */}
        <footer className="h-9 bg-white border-t border-slate-200/80 px-6 lg:px-8 flex items-center justify-between text-xs text-slate-400 font-normal shrink-0">
          <div className="flex items-center gap-2.5">
            <span>© 2026 Lentera Akunting</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="hidden sm:inline">Standar Akuntansi Keuangan SAK ETAP</span>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums">
            Pembaruan Terakhir: {new Date().toLocaleDateString('id-ID')}
          </div>
        </footer>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-72 bg-slate-900 z-50 lg:hidden flex flex-col"
              >
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">LP</span>
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">Lentera</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {/* Mobile Grouped Nav */}
                <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {navGroups.map((group) => (
                    <div key={group.groupName} className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-1 tracking-wider">
                        {group.groupName}
                      </div>
                      {group.items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) => cn(
                            "flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                            isActive ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </div>
                          {item.badge && (
                            <span className="text-[10px] font-mono text-amber-400/90 font-medium">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-2.5 text-slate-400 hover:bg-slate-800 hover:text-white border-none h-9 px-3 text-xs"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar Akun</span>
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
