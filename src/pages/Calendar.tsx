import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarComponent 
} from '@/components/ui/calendar';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { ScheduledPayment, COA, JournalStatus, AccountCategory } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format, isSameDay, parseISO } from 'date-fns';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Wallet, 
  ArrowRight, 
  ArrowLeftRight,
  Info,
  Calendar,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Coins,
  FileText,
  Check,
  Building,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [coas, setCoas] = useState<COA[]>([]);
  
  // Dialog Open States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { user } = useAuth();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'SELECTED' | 'ALL'>('SELECTED');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  // Execution modal states
  const [executingPayment, setExecutingPayment] = useState<ScheduledPayment | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [executionDate, setExecutionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [executionRef, setExecutionRef] = useState<string>('SCH-PAY');

  // New Payment Schedule Form State
  const [paymentData, setPaymentData] = useState({
    dueDate: new Date(),
    amount: 0,
    description: '',
    coaId: '',
    status: 'Pending' as const
  });

  useEffect(() => {
    if (!user) return;
    const unsubPayments = subscribeToCollection<ScheduledPayment>('scheduledPayments', setPayments, user.uid);
    const unsubCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    return () => { 
      unsubPayments(); 
      unsubCOA(); 
    };
  }, [user]);

  // Safe helper to parse Firebase Timestamp or string date
  const getPaymentDate = (p: ScheduledPayment): Date => {
    if (!p.dueDate) return new Date();
    if (typeof (p.dueDate as any).toDate === 'function') {
      return (p.dueDate as any).toDate();
    }
    try {
      return new Date(p.dueDate);
    } catch {
      return new Date();
    }
  };

  const handleCreate = async () => {
    if (!paymentData.description.trim()) {
      toast.error("Harap isi deskripsi pembayaran.");
      return;
    }
    if (!paymentData.coaId) {
      toast.error("Harap pilih akun alokasi biaya.");
      return;
    }
    if (paymentData.amount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari Rp 0.");
      return;
    }

    try {
      const selectedDate = date || new Date();
      await addDocument('scheduledPayments', {
        ...paymentData,
        dueDate: selectedDate
      });
      toast.success("Jadwal pembayaran berhasil ditambahkan!");
      setIsAddOpen(false);
      setPaymentData({
        dueDate: new Date(),
        amount: 0,
        description: '',
        coaId: '',
        status: 'Pending' as const
      });
    } catch (e) {
      toast.error("Gagal menambahkan jadwal pembayaran.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan jadwal pembayaran ini?")) return;
    try {
      await deleteDocument('scheduledPayments', id);
      toast.success("Jadwal pembayaran telah dibatalkan.");
    } catch (e) {
      toast.error("Gagal membatalkan pembayaran.");
    }
  };

  // Open the payment execution dialog
  const handleOpenExecute = (payment: ScheduledPayment) => {
    setExecutingPayment(payment);
    setExecutionDate(format(new Date(), 'yyyy-MM-dd'));
    setExecutionRef(`SCH-${payment.id?.slice(0, 5).toUpperCase() || 'PAY'}`);
    
    // Auto select first Cash/Bank account
    const firstCashBank = cashBankAccounts[0];
    if (firstCashBank) {
      setSelectedBankAccountId(firstCashBank.id || '');
    }
  };

  // Execute payment and write to journal + budgetTransactions
  const handleExecuteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingPayment) return;
    if (!selectedBankAccountId) {
      toast.error("Harap pilih akun Kas/Bank sumber dana.");
      return;
    }

    try {
      const p = executingPayment;
      const payDate = new Date(executionDate);

      // 1. Update Scheduled Payment status
      await updateDocument('scheduledPayments', p.id!, {
        status: 'Paid'
      });

      // 2. Add General Journal Entry (Double-Entry bookkeeping)
      // Debit: Expense COA of the scheduled payment
      // Credit: Selected Cash/Bank Asset Account
      const journalData = {
        date: payDate,
        description: `[Realisasi Jadwal] ${p.description}`,
        reference: executionRef || 'SCH-PAY',
        status: JournalStatus.POSTED,
        totalDebit: p.amount,
        totalCredit: p.amount,
        entries: [
          {
            coaId: p.coaId,
            debit: p.amount,
            credit: 0
          },
          {
            coaId: selectedBankAccountId,
            debit: 0,
            credit: p.amount
          }
        ]
      };
      await addDocument('journals', journalData);

      // 3. Add Budget Transaction (Pemotongan anggaran pengeluaran)
      const budgetTxData = {
        coaId: p.coaId,
        amount: p.amount,
        type: 'Pengurangan' as const,
        description: `Realisasi Jadwal: ${p.description}`,
        date: payDate
      };
      await addDocument('budgetTransactions', budgetTxData);

      toast.success("Pembayaran berhasil direalisasikan, dibukukan ke jurnal, dan memotong anggaran biaya terkait!");
      setExecutingPayment(null);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengeksekusi pembayaran.");
    }
  };

  const formatIDR = (val: number) => {
    return "Rp " + val.toLocaleString("id-ID");
  };

  // Suitable funding cash/bank accounts (Asset accounts)
  const cashBankAccounts = coas.filter(c => 
    c.category === AccountCategory.ASSET && 
    (c.code.startsWith('111') || c.name.toLowerCase().includes('kas') || c.name.toLowerCase().includes('bank'))
  );

  // Suitable expense accounts for payment schedules
  const expenseAccounts = coas.filter(c => 
    c.category === AccountCategory.EXPENSE || c.category === AccountCategory.LIABILITY
  );

  // Filter payments dynamically
  const filteredPayments = payments.filter(p => {
    // 1. Search Query filter (matches description or COA details)
    const coa = coas.find(c => c.id === p.coaId);
    const coaName = coa?.name?.toLowerCase() || '';
    const coaCode = coa?.code?.toLowerCase() || '';
    const desc = p.description?.toLowerCase() || '';
    const matchesSearch = desc.includes(searchQuery.toLowerCase()) || 
                          coaName.includes(searchQuery.toLowerCase()) || 
                          coaCode.includes(searchQuery.toLowerCase());

    // 2. Scope filter (Selected Day only vs All dates)
    const matchesScope = scopeFilter === 'ALL' || (date && isSameDay(getPaymentDate(p), date));

    // 3. Status filter
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'PENDING' && p.status !== 'Paid') ||
      (statusFilter === 'PAID' && p.status === 'Paid');

    return matchesSearch && matchesScope && matchesStatus;
  });

  // Calculate high level stats from ALL schedules
  const allScheduledTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const allPaidTotal = payments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const allPendingTotal = payments.filter(p => p.status !== 'Paid').reduce((sum, p) => sum + p.amount, 0);
  
  const pendingCount = payments.filter(p => p.status !== 'Paid').length;
  const paidCount = payments.filter(p => p.status === 'Paid').length;

  // Selected date-specific total stats
  const selectedDayAll = payments.filter(p => date && isSameDay(getPaymentDate(p), date));
  const selectedTotal = selectedDayAll.reduce((sum, p) => sum + p.amount, 0);
  const selectedPaid = selectedDayAll.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const selectedPending = selectedDayAll.filter(p => p.status !== 'Paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8 relative">
      
      {/* HEADER PANEL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
            <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest leading-none">
              Liquidity & Treasury Schedule
            </p>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">
            Financial Payment Calendar
          </h1>
          <p className="text-xs text-slate-400">
            Jadwalkan kewajiban kas keluar operasional, visualisasikan beban masa depan, dan eksekusi pembayaran instan dengan entri jurnal otomatis.
          </p>
        </div>
        <div>
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="rounded-xl bg-blue-600 text-white font-bold px-5 h-11 hover:bg-blue-700 transition-all shadow-md hover:shadow-blue-200 active:scale-95 text-xs flex items-center gap-2 border-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Jadwal Pembayaran
          </Button>
        </div>
      </div>

      {/* TOP ANALYTICS COUNTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Scheduled */}
        <div className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/40 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50/80 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Calendar className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="border-blue-100 bg-blue-50/20 text-blue-600 text-[9px] font-black rounded-md py-0.5 px-2">
              ALL SCHEDULES
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Rencana Pembayaran</span>
            <p className="text-xl font-mono font-black text-slate-900 tracking-tight leading-none">
              {formatIDR(allScheduledTotal)}
            </p>
          </div>
        </div>

        {/* Card 2: Pending Bills */}
        <div className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/40 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50/80 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Clock className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="border-amber-100 bg-amber-50/20 text-amber-600 text-[9px] font-black rounded-md py-0.5 px-2">
              PENDING: {pendingCount}
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kewajiban Belum Bayar</span>
            <p className="text-xl font-mono font-black text-amber-600 tracking-tight leading-none">
              {formatIDR(allPendingTotal)}
            </p>
          </div>
        </div>

        {/* Card 3: Realized */}
        <div className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/40 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50/80 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="border-emerald-100 bg-emerald-50/20 text-emerald-600 text-[9px] font-black rounded-md py-0.5 px-2">
              PAID: {paidCount}
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telah Direalisasikan</span>
            <p className="text-xl font-mono font-black text-emerald-600 tracking-tight leading-none">
              {formatIDR(allPaidTotal)}
            </p>
          </div>
        </div>

        {/* Card 4: Funding Sources */}
        <div className="border border-slate-100 rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50/80 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Building className="w-5 h-5" />
            </div>
            <Badge variant="outline" className="border-indigo-100 bg-indigo-50/20 text-indigo-600 text-[9px] font-black rounded-md py-0.5 px-2">
              KAS/BANK COAS
            </Badge>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Akun Sumber Dana Aktif</span>
            <p className="text-xl font-mono font-black text-indigo-900 tracking-tight leading-none">
              {cashBankAccounts.length} Rekening
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & ADVANCED CONTROLS HUB */}
      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-col xl:flex-row items-center gap-6 justify-between">
        
        {/* Search */}
        <div className="relative w-full xl:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input 
            type="text" 
            placeholder="Cari memo tagihan, nominal, atau kode akun..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 rounded-2xl text-xs font-semibold placeholder:text-slate-400 focus-visible:ring-blue-500/20 w-full"
          />
        </div>

        {/* Filter Controls tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
          {/* Scope selection */}
          <div className="space-y-1 sm:space-y-0 sm:flex sm:items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block sm:inline">Cakupan Tanggal:</span>
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setScopeFilter('SELECTED')}
                className={cn(
                  "px-3.5 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-wider transition-all",
                  scopeFilter === 'SELECTED' 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-950"
                )}
              >
                Hari Terpilih
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('ALL')}
                className={cn(
                  "px-3.5 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-wider transition-all",
                  scopeFilter === 'ALL' 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-950"
                )}
              >
                Semua Jadwal
              </button>
            </div>
          </div>

          {/* Status selection */}
          <div className="space-y-1 sm:space-y-0 sm:flex sm:items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block sm:inline">Status:</span>
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl">
              {(['ALL', 'PENDING', 'PAID'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3.5 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-wider transition-all",
                    statusFilter === status 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-950"
                  )}
                >
                  {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Belum Bayar' : 'Selesai'}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
        
        {/* LEFT COLUMN: Premium Calendar & Selected Date Status Dashboard (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          <Card className="rounded-3xl border border-slate-150/80 bg-white shadow-sm overflow-hidden p-4 relative">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />
            
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Kalender Pembayaran
              </span>
              <Badge variant="outline" className="text-[8px] font-bold bg-blue-50 text-blue-600 border-blue-100">
                Pilih Tanggal
              </Badge>
            </div>

            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={setDate}
              className="p-1 w-full"
              modifiers={{
                hasPending: (day) => payments.some(p => p.status === 'Pending' && isSameDay(getPaymentDate(p), day)),
                hasPaid: (day) => payments.some(p => p.status === 'Paid' && isSameDay(getPaymentDate(p), day)),
              }}
              classNames={{
                hasPending: "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-amber-500 after:animate-pulse",
                hasPaid: "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-emerald-500",
                day_selected: "bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white shadow-md shadow-blue-500/20 font-bold",
                day_today: "bg-blue-50 text-blue-600 font-black rounded-xl border border-blue-200/50",
                head_cell: "text-[11px] font-extrabold uppercase tracking-wider text-slate-400 py-3 text-center",
                cell: "p-0.5 h-11 w-11 text-center text-sm relative",
                day: "h-10 w-10 p-0 font-bold text-slate-600 hover:bg-slate-50 hover:rounded-xl transition-all relative flex items-center justify-center mx-auto"
              }}
            />

            {/* Quick calendar indicators legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-6 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Belum Dibayar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Telah Selesai
              </span>
            </div>
          </Card>

          {/* Date-Specific Quick Math Summary */}
          <Card className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Breakdown Kas Hari Ini
              </h4>
              <span className="text-xs font-extrabold text-slate-700">
                {date ? format(date, 'dd MMM yyyy') : ''}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide block">Rencana</span>
                <p className="text-xs font-mono font-black text-slate-800 leading-none">{formatIDR(selectedTotal)}</p>
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wide block">Realisasi</span>
                <p className="text-xs font-mono font-black text-emerald-600 leading-none">{formatIDR(selectedPaid)}</p>
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-2xl space-y-1 shadow-sm">
                <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wide block">Sisa Tagih</span>
                <p className="text-xs font-mono font-black text-amber-600 leading-none">{formatIDR(selectedPending)}</p>
              </div>
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN: Interactive Agenda Lists & Schedule Executions (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="flex items-center justify-between px-1">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                {scopeFilter === 'SELECTED' ? 'Jadwal Hari Terpilih' : 'Seluruh Daftar Antrean'}
              </p>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                {scopeFilter === 'SELECTED' && date ? format(date, 'MMMM dd, yyyy') : 'Semua Agenda Rencana Pembayaran'}
              </h3>
            </div>
            <div className="px-3.5 py-1.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">
                Total: {filteredPayments.length} Agenda
              </span>
            </div>
          </div>

          {/* Agenda Listing Cards */}
          {filteredPayments.length === 0 ? (
            <div className="h-[340px] rounded-[32px] border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-4 bg-white text-center p-8 shadow-sm">
               <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                 <Clock className="w-7 h-7" />
               </div>
               <div className="space-y-1">
                 <h4 className="text-sm font-extrabold text-slate-700">Tidak Ada Rencana Pembayaran</h4>
                 <p className="text-xs text-slate-400 max-w-sm leading-relaxed mx-auto">
                   Tidak ada tagihan atau pembayaran rutin terencana yang terdaftar dalam rentang penyaringan ini. Anda bisa menjadwalkan pembayaran baru menggunakan tombol di kanan atas.
                 </p>
               </div>
               {(searchQuery || statusFilter !== 'ALL') && (
                 <Button 
                   onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                   variant="outline" 
                   size="sm" 
                   className="rounded-xl px-4 border-slate-200 text-xs font-bold text-slate-600"
                 >
                   Reset Filter
                 </Button>
               )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayments.map((p, idx) => {
                const isPaid = p.status === 'Paid';
                const coaName = coas.find(c => c.id === p.coaId)?.name || 'Akun Tidak Ditemukan';
                const coaCode = coas.find(c => c.id === p.coaId)?.code || '';
                const payDate = getPaymentDate(p);

                return (
                  <div 
                    key={p.id || idx} 
                    className="bg-white border border-slate-100 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-md transition-all shadow-sm relative overflow-hidden group"
                  >
                    {/* Visual Status Indicator strip on the left margin */}
                    <div className={cn(
                      "absolute top-0 left-0 w-1.5 h-full transition-all",
                      isPaid ? "bg-emerald-500" : "bg-amber-500"
                    )} />

                    <div className="flex gap-4 items-center">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors",
                        isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5 animate-pulse" />}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold">
                            {coaCode}
                          </span>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
                            {coaName}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                          {p.description}
                        </h4>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          Jatuh Tempo: {format(payDate, 'dd MMMM yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:border-l sm:border-dashed sm:border-slate-100 sm:pl-6">
                      <div className="text-left sm:text-right space-y-1">
                        <p className="text-base font-black text-slate-900 font-mono tracking-tight leading-none">
                          {formatIDR(p.amount)}
                        </p>
                        <Badge variant="outline" className={cn(
                          "rounded text-[9px] font-black uppercase py-0.5 px-2 border leading-none",
                          isPaid ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100 animate-pulse"
                        )}>
                          {isPaid ? 'Sudah Dibayar' : 'Menunggu Realisasi'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid ? (
                          <Button 
                            onClick={() => handleOpenExecute(p)}
                            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase h-9 px-4 transition-all shadow-sm active:scale-95 border-0 flex items-center gap-1.5"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            Bayar
                          </Button>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-400 font-extrabold text-[9px] uppercase h-9 px-3 rounded-xl border-0 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Selesai
                          </Badge>
                        )}

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(p.id!)}
                          className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all h-9 w-9 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* DIALOG: CREATE NEW PAYMENT SCHEDULE */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 bg-white border border-slate-150 shadow-2xl">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Buat Rencana Pembayaran
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed font-sans">
              Petakan pembayaran biaya operasional rutin masa depan atau cicilan tagihan di kalender keuangan agar terpantau dalam anggaran.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            
            {/* Payment Memo */}
            <div className="space-y-1.5">
               <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                 Memo / Deskripsi Pembayaran
               </label>
               <Input 
                 className="rounded-xl border-slate-200 h-11 bg-slate-50 focus:bg-white focus-visible:ring-blue-500/10 transition-all text-xs font-bold text-slate-900" 
                 placeholder="Misal: Langganan Cloud Hosting VPS Bulanan"
                 value={paymentData.description}
                 onChange={e => setPaymentData({...paymentData, description: e.target.value})}
               />
            </div>

            {/* Target Account selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Akun Alokasi Biaya (COA)
              </label>
              <Select value={paymentData.coaId} onValueChange={v => setPaymentData({...paymentData, coaId: v})}>
                 <SelectTrigger className="rounded-xl border-slate-200 h-11 bg-slate-50 text-xs font-bold text-slate-700 w-full focus:ring-blue-500/10">
                    <SelectValue placeholder="Pilih Akun Beban/Liabilitas" />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl bg-white border-slate-250 shadow-lg max-h-52 overflow-y-auto">
                    {expenseAccounts.map(c => (
                      <SelectItem key={c.id} value={c.id!} className="text-xs font-semibold text-slate-700 h-9 rounded-lg">
                        {c.code} — {c.name} ({c.category})
                      </SelectItem>
                    ))}
                 </SelectContent>
              </Select>
            </div>

            {/* Amount and Date Preview */}
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Nominal Transfer (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">Rp</span>
                    <Input 
                      type="number" 
                      className="rounded-xl border-slate-200 h-11 bg-slate-50 pl-9 font-bold text-xs font-mono text-slate-950" 
                      placeholder="1500000"
                      value={paymentData.amount || ''}
                      onChange={e => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Jatuh Tempo Terpilih
                  </label>
                  <div className="h-11 rounded-xl bg-slate-100 border border-slate-200 px-3 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="truncate">
                      {date ? format(date, 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </div>
               </div>
            </div>

            <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl border-slate-200 font-bold text-xs h-11 px-5"
              >
                Batal
              </Button>
              <Button 
                onClick={handleCreate} 
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 px-5 transition-all active:scale-[0.98] border-0"
              >
                Jadwalkan Sekarang
              </Button>
            </DialogFooter>

          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EXECUTE PAYMENT & ACCOUNTING JOURNAL GENERATION (DOUBLE-ENTRY) */}
      <Dialog open={!!executingPayment} onOpenChange={(open) => !open && setExecutingPayment(null)}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-white border border-slate-150 shadow-2xl">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              Realisasi Pembayaran Kas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed font-sans">
              Lakukan pencatatan pengeluaran dana Kas/Bank secara instan. Sistem akan mengotomatisasikan penjurnalan akuntansi berpasangan (Double-Entry).
            </DialogDescription>
          </DialogHeader>

          {executingPayment && (
            <form onSubmit={handleExecuteSubmit} className="space-y-4 pt-4">
              
              {/* Premium Transaction Details Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase">
                    MEMO JADWAL PEMBAYARAN
                  </span>
                  <Badge variant="outline" className="rounded bg-amber-50 border-amber-100 text-amber-600 font-extrabold text-[8px] py-0 px-2 leading-none">
                    PENDING TRANSFER
                  </Badge>
                </div>

                <h4 className="text-sm font-extrabold text-slate-800 leading-snug">
                  {executingPayment.description}
                </h4>

                <div className="space-y-1.5 pt-2.5 border-t border-dashed border-slate-200 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pos Alokasi Beban:</span>
                    <span className="font-bold text-slate-700 text-right">
                      {coas.find(c => c.id === executingPayment.coaId)?.name || 'Beban Akun'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Tagihan:</span>
                    <span className="text-sm font-black text-blue-600 font-mono">
                      {formatIDR(executingPayment.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Advanced Accounting Double-Entry ledger preview flow chart */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2.5 border border-slate-800 relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block">
                  SIMULASI DEBIT-KREDIT JURNAL AKUNTANSI
                </span>
                
                <div className="space-y-2 font-mono text-[10px] font-bold text-slate-300">
                  {/* Debit row */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-950 border border-emerald-900 text-emerald-400 font-black text-[8px] px-1.5 py-0.5 rounded">
                        [D] DEBIT
                      </span>
                      <span className="truncate max-w-[180px] text-slate-100">
                        {coas.find(c => c.id === executingPayment.coaId)?.name || 'Akun Beban'}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-semibold">{formatIDR(executingPayment.amount)}</span>
                  </div>

                  {/* Credit row */}
                  <div className="flex items-center justify-between gap-2 pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-rose-950 border border-rose-900 text-rose-400 font-black text-[8px] px-1.5 py-0.5 rounded">
                        [K] KREDIT
                      </span>
                      <span className="truncate max-w-[180px] text-slate-400 italic">
                        {selectedBankAccountId 
                          ? coas.find(c => c.id === selectedBankAccountId)?.name 
                          : 'Pilih Kas/Bank...'}
                      </span>
                    </div>
                    <span className="text-rose-400 font-semibold">{formatIDR(executingPayment.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Funding source select input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Kas / Rekening Bank Pembayar
                </label>
                <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                  <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:ring-blue-500/10">
                    <SelectValue placeholder="Pilih Kas atau Rekening Bank Utama" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-250 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {cashBankAccounts.map(coa => (
                      <SelectItem 
                        key={coa.id} 
                        value={coa.id!} 
                        className="text-xs font-bold text-slate-700 h-9 rounded-md"
                      >
                        {coa.code} — {coa.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inputs: Realization Date & Ref */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Tanggal Realisasi
                  </label>
                  <Input 
                    type="date" 
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus-visible:ring-blue-500/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    No Referensi / Voucher
                  </label>
                  <Input 
                    type="text" 
                    value={executionRef}
                    onChange={(e) => setExecutionRef(e.target.value)}
                    placeholder="SCH-PAY"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus-visible:ring-blue-500/10"
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setExecutingPayment(null)}
                  className="rounded-xl border-slate-200 font-bold text-xs h-11 px-5"
                >
                  Kembali
                </Button>
                <Button 
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 px-5 active:scale-95 transition-all border-0 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Selesaikan & Posting Jurnal
                </Button>
              </DialogFooter>

            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
