import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Target,
  FileSpreadsheet,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { subscribeToCollection } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Journal, AccountCategory, JournalStatus } from '../types';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const getSafeDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal && typeof dateVal === 'object' && typeof dateVal.seconds === 'number') {
    return new Date(dateVal.seconds * 1000);
  }
  try {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
};

const monthlyPerformanceData = [
  { name: 'Jan', revenue: 42000000, expenses: 24500000 },
  { name: 'Feb', revenue: 38000000, expenses: 19800000 },
  { name: 'Mar', revenue: 51000000, expenses: 31200000 },
  { name: 'Apr', revenue: 47800000, expenses: 28900000 },
  { name: 'Mei', revenue: 56400000, expenses: 34100000 },
  { name: 'Jun', revenue: 62500000, expenses: 36800000 },
];

export default function Dashboard() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | 'quarter'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const unsubscribeCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubscribeJournals = subscribeToCollection<Journal>('journals', setJournals, user.uid);
    return () => {
      unsubscribeCOA();
      unsubscribeJournals();
    };
  }, [user]);

  const totalRevenue = journals.reduce((acc, j) => acc + (j.entries.filter(e => {
    const coa = coas.find(c => c.id === e.coaId);
    return coa?.category === AccountCategory.REVENUE;
  }).reduce((sum, e) => sum + e.credit - e.debit, 0)), 0);

  const totalExpense = journals.reduce((acc, j) => acc + (j.entries.filter(e => {
    const coa = coas.find(c => c.id === e.coaId);
    return coa?.category === AccountCategory.EXPENSE;
  }).reduce((sum, e) => sum + e.debit - e.credit, 0)), 0);

  const netIncome = totalRevenue - totalExpense;

  const handleExportData = () => {
    try {
      const csvRows = [
        ['Lentera Akunting - Ringkasan Eksekutif'],
        ['Tanggal Ekspor', new Date().toLocaleString('id-ID')],
        ['Total Pendapatan', `Rp ${totalRevenue.toLocaleString('id-ID')}`],
        ['Total Beban', `Rp ${totalExpense.toLocaleString('id-ID')}`],
        ['Laba Bersih', `Rp ${netIncome.toLocaleString('id-ID')}`],
        ['Jumlah Akun Aktif', coas.length.toString()],
        [''],
        ['Daftar 10 Transaksi Terakhir'],
        ['Tanggal', 'Deskripsi', 'Referensi', 'Total (Rp)'],
        ...journals.slice(0, 10).map(j => [
          format(getSafeDate(j.date), 'yyyy-MM-dd'),
          `"${j.description?.replace(/"/g, '""') || ''}"`,
          j.reference || '-',
          (j.totalDebit || 0).toString()
        ])
      ];

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ringkasan_keuangan_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Data ringkasan berhasil diekspor ke CSV");
    } catch {
      toast.error("Gagal mengekspor data");
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Ringkasan Keuangan</span>
             <span aria-hidden="true">·</span>
             <span>Tahun Buku {new Date().getFullYear()}</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <Button 
              variant="outline" 
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="rounded-lg border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors h-9 px-3"
            >
              <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Periode: {periodFilter === 'all' ? 'Semua' : periodFilter === 'month' ? 'Bulan Ini' : 'Kuartal Ini'}</span>
            </Button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 text-xs">
                <button
                  onClick={() => { setPeriodFilter('all'); setShowFilterMenu(false); }}
                  className={cn("w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors font-medium", periodFilter === 'all' && "text-blue-600 font-semibold")}
                >
                  Semua Periode
                </button>
                <button
                  onClick={() => { setPeriodFilter('month'); setShowFilterMenu(false); }}
                  className={cn("w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors font-medium", periodFilter === 'month' && "text-blue-600 font-semibold")}
                >
                  Bulan Berjalan
                </button>
                <button
                  onClick={() => { setPeriodFilter('quarter'); setShowFilterMenu(false); }}
                  className={cn("w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors font-medium", periodFilter === 'quarter' && "text-blue-600 font-semibold")}
                >
                  Kuartal Ini
                </button>
              </div>
            )}
          </div>
          <Button 
            onClick={handleExportData}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors h-9 px-3.5"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPI 
          label="Total Pendapatan" 
          value={`Rp ${totalRevenue.toLocaleString("id-ID")}`} 
          change="+12.5%" 
          positive={true} 
          icon={TrendingUp} 
        />
        <KPI 
          label="Total Beban Usaha" 
          value={`Rp ${totalExpense.toLocaleString("id-ID")}`} 
          change="+8.2%" 
          positive={false} 
          icon={TrendingDown} 
        />
        <KPI 
          label="Laba Bersih (Net Income)" 
          value={`Rp ${netIncome.toLocaleString("id-ID")}`} 
          change="+24.1%" 
          positive={netIncome >= 0} 
          icon={DollarSign} 
          highlight 
        />
        <KPI 
          label="Bagan Akun (COA)" 
          value={coas.length.toString()} 
          change={`${coas.length} akun aktif`}
          positive={true} 
          icon={Activity} 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200/90 bg-white shadow-none rounded-xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Tren Pendapatan vs Beban Operasional
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
                  Pendapatan
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  Beban
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[360px] pt-6">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyPerformanceData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${v / 1000000}M`}
                    dx={-6}
                  />
                  <Tooltip 
                    formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, '']}
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: 'none', 
                      borderRadius: '8px', 
                      color: '#f8fafc',
                      fontSize: '12px',
                      fontWeight: 500,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Pendapatan"
                    stroke="#2563eb" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expenses" 
                    name="Beban"
                    stroke="#f43f5e" 
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="transparent" 
                  />
                </AreaChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-none rounded-xl overflow-hidden">
           <CardHeader className="border-b border-slate-100 pb-3">
             <CardTitle className="text-sm font-semibold text-slate-900">Distribusi Beban Utama</CardTitle>
             <CardDescription className="text-xs text-slate-400">Alokasi pos pengeluaran berjalan</CardDescription>
           </CardHeader>
           <CardContent className="h-[340px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                   { name: 'Sewa Gedung', value: 18500000 },
                   { name: 'Gaji & Upah', value: 34200000 },
                   { name: 'Utilitas & Listrik', value: 6800000 },
                   { name: 'Operasional Kas', value: 11400000 },
                 ]} layout="vertical" margin={{ left: -15, right: 15 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={110} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 500, fill: '#334155' }}
                    />
                    <Tooltip 
                      formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}`, 'Nominal']}
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#f8fafc', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                       <Cell fill="#2563eb" />
                       <Cell fill="#3b82f6" opacity={0.85} />
                       <Cell fill="#60a5fa" opacity={0.7} />
                       <Cell fill="#93c5fd" opacity={0.55} />
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </CardContent>
        </Card>
      </div>

      {/* Recent Transations & Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Transaksi Jurnal Terakhir</span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">({journals.length})</span>
             </div>
             <button 
               onClick={() => navigate('/journal')}
               className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
             >
               Buka Semua Jurnal →
             </button>
          </div>
          <div className="space-y-3">
             {journals.slice(0, 5).map((j, i) => (
               <div 
                 key={j.id || i} 
                 onClick={() => navigate('/journal')}
                 className="group bg-white p-4 items-center flex justify-between border border-slate-200/80 rounded-xl hover:border-blue-300 transition-all cursor-pointer"
               >
                  <div className="flex items-center gap-4">
                     <div className="w-11 h-11 flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100 group-hover:bg-blue-50/60 group-hover:border-blue-200 transition-colors shrink-0">
                        <span className="text-[10px] font-medium uppercase text-slate-400 leading-none mb-0.5">{format(getSafeDate(j.date), 'MMM')}</span>
                        <span className="text-base font-bold font-mono text-slate-800 leading-none">{format(getSafeDate(j.date), 'dd')}</span>
                     </div>
                     <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate mb-1">{j.description}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                           <span className="font-mono">{j.reference || 'GL-POST'}</span>
                           <span aria-hidden="true">·</span>
                           <span>Terposting</span>
                        </div>
                     </div>
                  </div>
                  <div className="text-right shrink-0">
                     <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mb-0.5">
                       Rp {(j.totalDebit || 0).toLocaleString('id-ID')}
                     </p>
                     <p className="text-[11px] text-emerald-600 font-medium">Seimbang</p>
                  </div>
               </div>
             ))}
             {journals.length === 0 && (
               <div className="p-8 text-center bg-white border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                 Belum ada transaksi jurnal yang diposting.
               </div>
             )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Pemantauan Anggaran Departemen</span>
             </div>
             <button 
               onClick={() => navigate('/budget')}
               className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
             >
               Kelola Anggaran →
             </button>
          </div>
          <div className="space-y-3">
             {[
               { name: 'Operasional Pemasaran', utilized: 68, allocated: 'Rp 50.000.000' },
               { name: 'Infrastruktur TI & Cloud', utilized: 54, allocated: 'Rp 35.000.000' },
               { name: 'Pengembangan Usaha', utilized: 72, allocated: 'Rp 40.000.000' },
               { name: 'Administrasi & Kantor', utilized: 45, allocated: 'Rp 25.000.000' }
             ].map((b, i) => (
               <div key={i} className="bg-white p-4 border border-slate-200/80 rounded-xl">
                  <div className="flex items-center justify-between mb-2.5">
                     <div>
                       <span className="text-xs font-semibold text-slate-800 block">{b.name}</span>
                       <span className="text-[11px] text-slate-400 font-mono tabular-nums">Pagu: {b.allocated}</span>
                     </div>
                     <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                       {b.utilized}%
                     </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${b.utilized}%` }}
                        transition={{ duration: 1, delay: 0.1 * i, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full transition-all",
                          b.utilized > 70 ? "bg-amber-500" : "bg-blue-600"
                        )} 
                     />
                  </div>
               </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function KPI({ label, value, change, positive, icon: Icon, highlight }: any) {
  return (
    <div className={cn(
      "p-5 flex flex-col justify-between rounded-xl border transition-all duration-200",
      highlight 
        ? "bg-slate-900 text-white border-slate-900" 
        : "bg-white border-slate-200/90 hover:border-slate-300"
    )}>
      <div className="flex items-center justify-between mb-4">
        <span className={cn(
          "text-xs font-medium", 
          highlight ? "text-slate-400" : "text-slate-500"
        )}>
          {label}
        </span>
        <div className={cn(
          "p-1.5 rounded-md",
          highlight ? "bg-white/10 text-white" : "bg-slate-50 text-slate-500"
        )}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold font-mono tabular-nums tracking-tight mb-2">{value}</h3>
        <div className="flex items-center gap-2 text-xs">
           <div className={cn(
             "flex items-center gap-1 font-mono font-medium",
             positive 
               ? (highlight ? "text-emerald-400" : "text-emerald-600") 
               : (highlight ? "text-rose-400" : "text-rose-600")
           )}>
             {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
             <span>{change}</span>
           </div>
           <span aria-hidden="true" className={highlight ? "text-slate-600" : "text-slate-300"}>·</span>
           <span className={cn(
             "font-normal text-[11px]", 
             highlight ? "text-slate-400" : "text-slate-500"
           )}>
             vs periode lalu
           </span>
        </div>
      </div>
    </div>
  );
}
