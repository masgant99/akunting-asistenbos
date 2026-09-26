import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { 
  ShieldCheck, 
  BookOpen, 
  PieChart, 
  Target, 
  Calendar, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Lock,
  Globe,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function LoginPage() {
  const { login } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      await login();
      toast.success("Autentikasi berhasil! Selamat datang di Lentera Akunting.");
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('popup-closed-by-user')) {
        toast.error("Proses masuk dibatalkan oleh pengguna.");
      } else {
        toast.error("Gagal melakukan autentikasi. Harap coba lagi.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const systemHighlights = [
    {
      icon: BookOpen,
      title: "Double-Entry Ledger",
      desc: "Sistem pencatatan jurnal berpasangan otomatis dengan standardisasi SAK-ETAP nasional."
    },
    {
      icon: Target,
      title: "Treasury Budget Control",
      desc: "Pantau penyerapan anggaran operasional secara real-time berdasarkan pos kategori akun."
    },
    {
      icon: Calendar,
      title: "Liquidity Schedule",
      desc: "Kalender pintar penjadwalan kas keluar rutin dengan penyesuaian anggaran dinamis."
    },
    {
      icon: PieChart,
      title: "Standard Reports",
      desc: "Neraca saldo, laporan laba rugi, dan ringkasan eksekutif arus kas instan sekali klik."
    }
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans relative overflow-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT PANEL: Branding & System Features Showcase (60% Desktop) */}
      <div className="flex-1 lg:flex-[1.3] p-8 lg:p-16 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/60 backdrop-blur-md">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white font-black text-sm tracking-tighter">LP</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
              Lentera
            </h1>
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-blue-600">
              Accounting Engine
            </span>
          </div>
        </div>

        {/* Dynamic Marketing & Feature Showcase */}
        <div className="my-12 lg:my-0 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100/80 text-blue-700 rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider">PREMIUM FINANCIAL PLATFORM</span>
          </div>

          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Kendalikan Finansial <br />
            Perusahaan dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Presisi Mutlak.</span>
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-lg mb-12">
            Platform akunting modern untuk pelacakan transaksi kas, penyusunan jurnal akuntansi, pengelolaan anggaran bulanan, dan laporan audit otomatis.
          </p>

          {/* Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {systemHighlights.map((hl, idx) => (
              <div 
                key={idx} 
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 hover:bg-white transition-all duration-200 group"
              >
                <div className="p-2.5 bg-blue-50/50 text-blue-600 rounded-xl w-fit group-hover:bg-blue-600 group-hover:text-white transition-colors mb-3">
                  <hl.icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">
                  {hl.title}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  {hl.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Footer Credits */}
        <div className="hidden lg:flex items-center justify-between text-[10px] text-slate-400 font-semibold border-t border-slate-150 pt-6 mt-8">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Kepatuhan SAK-ETAP & PSAK</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Stable v4.2.0</span>
            <span>&bull;</span>
            <span>Secure 256-Bit SSL</span>
          </div>
        </div>

      </div>

      {/* RIGHT PANEL: Interactive Sign In Form Component (40% Desktop) */}
      <div className="flex-1 lg:flex-[0.9] flex flex-col justify-center items-center p-8 lg:p-16 bg-slate-50">
        
        <div className="w-full max-w-md space-y-8 bg-white border border-slate-150 p-8 lg:p-10 rounded-[32px] shadow-sm relative overflow-hidden">
          {/* Subtle Accent Stripe */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-blue-600" />

          <div className="space-y-2 text-center sm:text-left">
            <span className="text-[9px] font-black tracking-widest text-blue-600 uppercase">
              SECURE ENGINE GATE
            </span>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              Selamat Datang Kembali
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Masuk menggunakan akun terverifikasi Anda untuk mengakses panel utama Lentera Akunting.
            </p>
          </div>

          <div className="space-y-4">
            {/* Authenticate Button */}
            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-slate-950/5 relative group"
            >
              {isAuthenticating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menghubungkan Akun...</span>
                </>
              ) : (
                <>
                  {/* Google Custom Minimal Vector Logo */}
                  <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>Masuk dengan Google</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </>
              )}
            </button>

            {/* Platform Trust Info */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-3">
              <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="text-[10px] font-extrabold text-slate-950 uppercase tracking-wider">
                  Enkripsi Sesi Aman
                </h5>
                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                  Sesi Anda terlindungi enkripsi ujung-ke-ujung Firebase. Kami tidak pernah menyimpan sandi Anda secara langsung.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-col items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-300" />
              Tersinkronisasi dengan Cloud Database
            </span>
            <span>Butuh bantuan? Hubungi Support Center</span>
          </div>

        </div>

      </div>

    </div>
  );
}
