import React, { useState, useEffect } from 'react';
import { subscribeToCollection, addDocument, deleteDocument } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Journal, AccountCategory, JournalStatus, NormalBalance } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Wallet, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Plus, 
  Search, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeftRight, 
  Clock, 
  Sparkles, 
  Building2, 
  HelpCircle, 
  RefreshCw,
  Coins,
  History,
  Info,
  CreditCard,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

export default function CashBankPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [mode, setMode] = useState<'IN' | 'OUT'>('OUT');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    cashAccount: '',
    targetAccount: '',
    amount: 0,
    description: ''
  });

  useEffect(() => {
    if (!user) return;
    const unsubCoas = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubJournals = subscribeToCollection<Journal>('journals', setJournals, user.uid);
    return () => {
      unsubCoas();
      unsubJournals();
    };
  }, [user]);

  // Format IDR Helper
  const formatIDR = (val: number) => {
    return "Rp " + val.toLocaleString("id-ID");
  };

  // Filter Cash & Bank accounts from COA (Asset accounts with codes starting with 111/112 or containing Kas/Bank/Setara)
  const cashBankAccounts = coas.filter(c =>
    c.category === AccountCategory.ASSET &&
    (c.code.startsWith('111') || 
     c.code.startsWith('112') || 
     c.name.toLowerCase().includes('kas') || 
     c.name.toLowerCase().includes('cash') || 
     c.name.toLowerCase().includes('bank') ||
     c.name.toLowerCase().includes('rekening'))
  );

  // Set default selected Cash Account on load
  useEffect(() => {
    if (cashBankAccounts.length > 0 && !formData.cashAccount) {
      setFormData(prev => ({ ...prev, cashAccount: cashBankAccounts[0].id || '' }));
    }
  }, [cashBankAccounts, formData.cashAccount]);

  // Calculate dynamic real-time balance of a specific account
  const getAccountBalance = (coaId: string) => {
    let balance = 0;
    journals.forEach(j => {
      j.entries.forEach(e => {
        if (e.coaId === coaId) {
          balance += (e.debit - e.credit);
        }
      });
    });
    return balance;
  };

  // Suitable allocation accounts (target)
  const targetAccounts = coas.filter(c => {
    const isCashAcct = cashBankAccounts.some(cb => cb.id === c.id);
    if (isCashAcct) return false; // Prevent selecting the same cash account

    if (mode === 'OUT') {
      // For payments: Expenses, Liabilities, or other Assets (e.g., purchasing supplies)
      return c.category === AccountCategory.EXPENSE || 
             c.category === AccountCategory.LIABILITY || 
             c.category === AccountCategory.ASSET;
    } else {
      // For collection: Revenues, or Assets (e.g. Accounts Receivable / Piutang)
      return c.category === AccountCategory.REVENUE || 
             c.category === AccountCategory.ASSET ||
             c.category === AccountCategory.LIABILITY;
    }
  });

  // Calculate high-level treasury metrics
  const totalCashBalance = cashBankAccounts.reduce((sum, c) => sum + getAccountBalance(c.id || ''), 0);

  // Cash In / Out sums
  let totalCashIn = 0;
  let totalCashOut = 0;

  journals.forEach(j => {
    j.entries.forEach(e => {
      const isCashAccount = cashBankAccounts.some(c => c.id === e.coaId);
      if (isCashAccount) {
        if (e.debit > 0) {
          totalCashIn += e.debit;
        }
        if (e.credit > 0) {
          totalCashOut += e.credit;
        }
      }
    });
  });

  // Handle operation submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cashAccount || !formData.targetAccount || formData.amount <= 0) {
      toast.error("Harap lengkapi semua parameter mutasi kas.");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Harap isi deskripsi transaksi.");
      return;
    }

    // Safety Balance Check for Disbursements
    const currentBal = getAccountBalance(formData.cashAccount);
    if (mode === 'OUT' && formData.amount > currentBal) {
      if (!confirm(`Peringatan: Nominal pengeluaran (${formatIDR(formData.amount)}) melebihi saldo kas yang tersedia (${formatIDR(currentBal)}). Apakah Anda ingin melanjutkan transaksi dengan saldo minus?`)) {
        return;
      }
    }

    try {
      const entries = mode === 'OUT' ? [
        { coaId: formData.targetAccount, debit: formData.amount, credit: 0 },
        { coaId: formData.cashAccount, debit: 0, credit: formData.amount }
      ] : [
        { coaId: formData.cashAccount, debit: formData.amount, credit: 0 },
        { coaId: formData.targetAccount, debit: 0, credit: formData.amount }
      ];

      const referenceCode = `CB-${mode}-${Date.now().toString().slice(-4)}`;

      // 1. Post to general journal (double-entry)
      await addDocument('journals', {
        date: new Date(formData.date),
        description: `[CASH-${mode}] ${formData.description}`,
        status: JournalStatus.POSTED,
        entries,
        totalDebit: formData.amount,
        totalCredit: formData.amount,
        reference: referenceCode
      });

      // 2. Add system notification
      await addDocument('notifications', {
        message: `Mutasi Kas ${mode === 'OUT' ? 'Keluar' : 'Masuk'} berhasil dibukukan: ${formatIDR(formData.amount)} untuk [${formData.description}]`,
        type: 'Success',
        read: false
      });

      // 3. If it is a disbursement and matches an expense, let's also write to budget transactions if relevant
      if (mode === 'OUT') {
        await addDocument('budgetTransactions', {
          coaId: formData.targetAccount,
          amount: formData.amount,
          type: 'Pengurangan' as const,
          description: `Mutasi Kas Outflow: ${formData.description}`,
          date: new Date(formData.date)
        });
      }

      toast.success(`Arus Kas ${mode === 'OUT' ? 'Disbursement' : 'Collection'} berhasil diotorisasi!`);
      setFormData(prev => ({
        ...prev,
        description: '',
        amount: 0
      }));
    } catch (err) {
      console.error(err);
      toast.error("Transaksi gagal diotorisasi.");
    }
  };

  // Delete transaction with cascaded cleanup
  const handleDeleteTransaction = async (journalId: string, description: string) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan transaksi mutasi kas ini? Jurnal akuntansi terkait akan dihapus secara permanen.`)) {
      return;
    }

    try {
      await deleteDocument('journals', journalId);
      
      // Attempt to clean up budget transactions of similar descriptions if any
      const budgetTxs = await new Promise<any[]>((resolve) => {
        const unsub = subscribeToCollection<any>('budgetTransactions', (data) => {
          unsub();
          resolve(data);
        }, user?.uid);
      });

      const matchedBtx = budgetTxs.find(b => b.description?.includes(description));
      if (matchedBtx?.id) {
        await deleteDocument('budgetTransactions', matchedBtx.id);
      }

      toast.success("Transaksi mutasi kas berhasil dibatalkan & dibalik.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus transaksi.");
    }
  };

  // Find all Journals containing cash bank accounts to show in History
  const cashTransactions = journals.filter(j => {
    const isCashMutation = j.entries.some(e => cashBankAccounts.some(c => c.id === e.coaId));
    
    // Apply search query filter if any
    if (!searchQuery) return isCashMutation;
    
    const desc = j.description?.toLowerCase() || '';
    const ref = j.reference?.toLowerCase() || '';
    const matchesSearch = desc.includes(searchQuery.toLowerCase()) || ref.includes(searchQuery.toLowerCase());
    return isCashMutation && matchesSearch;
  });

  const activeCashAccountObj = coas.find(c => c.id === formData.cashAccount);
  const activeTargetAccountObj = coas.find(c => c.id === formData.targetAccount);
  const selectedAccountBalance = formData.cashAccount ? getAccountBalance(formData.cashAccount) : 0;
  const isBalanceWarning = mode === 'OUT' && formData.amount > selectedAccountBalance;

  return (
    <div className="space-y-8 relative">
      
      {/* PREMIUM HEADER PANEL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <p className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest leading-none">
              Liquid Asset Cockpit
            </p>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">
            Treasury Cash & Bank
          </h1>
          <p className="text-xs text-slate-400">
            Kelola mutasi penerimaan (Collection) dan pengeluaran (Disbursement) likuiditas perusahaan secara real-time dengan audit trail berpasangan otomatis.
          </p>
        </div>
      </div>

      {/* LIQUIDITY METRICS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Total Liquid Assets */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Total Saldo Likuiditas</span>
            <div className="p-1.5 bg-slate-50 text-blue-600 rounded-md">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-mono tabular-nums font-bold text-slate-900 tracking-tight leading-none">
              {formatIDR(totalCashBalance)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>{cashBankAccounts.length} rekening aktif</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Receipts (Collection) */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Akumulasi Kas Masuk</span>
            <div className="p-1.5 bg-slate-50 text-emerald-600 rounded-md">
              <ArrowUpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-mono tabular-nums font-bold text-emerald-600 tracking-tight leading-none">
              {formatIDR(totalCashIn)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Penerimaan terealisasi</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Payments (Disbursements) */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Akumulasi Kas Keluar</span>
            <div className="p-1.5 bg-slate-50 text-rose-600 rounded-md">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-mono tabular-nums font-bold text-rose-600 tracking-tight leading-none">
              {formatIDR(totalCashOut)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>Pengeluaran operasional</span>
            </div>
          </div>
        </div>
      </div>

      {/* ACCOUNT CARDS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-slate-700">
            Daftar Rekening Kas & Bank Terdaftar ({cashBankAccounts.length})
          </span>
          <span className="text-xs text-slate-400">
            Pilih rekening untuk transaksi mutasi
          </span>
        </div>

        {cashBankAccounts.length === 0 ? (
          <Card className="border border-dashed border-slate-200 bg-white rounded-xl p-8 text-center shadow-none">
            <CardContent className="space-y-3 p-0 flex flex-col items-center">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-800 text-sm">Tidak Ada Rekening Kas/Bank</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Tambahkan akun kategori Kas atau Bank di menu <strong>Bagan Akun (COA)</strong> untuk mulai mencatat mutasi.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cashBankAccounts.map((c) => {
              const bal = getAccountBalance(c.id || '');
              const isSelected = formData.cashAccount === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => setFormData(prev => ({ ...prev, cashAccount: c.id || '' }))}
                  className={cn(
                    "rounded-xl p-4 transition-all cursor-pointer border select-none flex flex-col justify-between h-[130px]",
                    isSelected 
                      ? "border-blue-600 bg-blue-50/20 shadow-sm" 
                      : "border-slate-200/90 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-xs font-mono text-slate-400 block mb-0.5">
                        {c.code}
                      </span>
                      <h4 className="font-semibold text-sm text-slate-900 truncate max-w-[170px]">
                        {c.name}
                      </h4>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">Saldo</span>
                    <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                      {formatIDR(bal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OPERATIONS CENTER: SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
        
        {/* LEFT PANEL: History & Searchable Ledger Mutasi (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Riwayat & Log Mutasi Kas / Bank ({cashTransactions.length})
              </h3>
            </div>
            
            {/* Search Input for Ledger Log */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Cari deskripsi atau no voucher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus-visible:ring-blue-500/10 w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            {cashTransactions.length === 0 ? (
              <div className="h-[360px] rounded-[32px] border border-dashed border-slate-200 flex flex-col items-center justify-center space-y-4 bg-white text-center p-8 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                  <History className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-700">Belum Ada Riwayat Mutasi</h4>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed mx-auto">
                    Seluruh arus kas masuk dan kas keluar langsung yang direkam lewat menu ini akan dicatatkan di bawah sini lengkap dengan nomor voucher jurnal.
                  </p>
                </div>
                {searchQuery && (
                  <Button 
                    onClick={() => setSearchQuery('')}
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl px-4 border-slate-200 text-xs font-bold text-slate-600 h-9"
                  >
                    Reset Pencarian
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-2">
                {cashTransactions.map((tx) => {
                  // Figure out direction & details of this cash transaction
                  // We can find if the Cash/Bank account was debited or credited in entries
                  const cashEntry = tx.entries.find(e => cashBankAccounts.some(c => c.id === e.coaId));
                  const isDisbursement = cashEntry ? cashEntry.credit > 0 : false;
                  
                  const cashAcctName = coas.find(c => c.id === cashEntry?.coaId)?.name || 'Kas/Bank';
                  
                  // Target account is the non-cash entry
                  const targetEntry = tx.entries.find(e => !cashBankAccounts.some(c => c.id === e.coaId));
                  const targetAcctName = coas.find(c => c.id === targetEntry?.coaId)?.name || 'Akun Kontra';
                  
                  // Clean up description if it starts with [CASH-IN] or [CASH-OUT]
                  const cleanDesc = tx.description?.replace(/^\[CASH-(IN|OUT)\]\s*/, '') || '';

                  return (
                    <div 
                      key={tx.id}
                      className={cn(
                        "p-5 rounded-2xl border flex items-center justify-between gap-4 bg-white transition-all hover:shadow-md relative group",
                        isDisbursement ? "border-rose-100/40" : "border-emerald-100/40"
                      )}
                    >
                      {/* Left vertical strip indicator */}
                      <div className={cn(
                        "absolute left-0 top-0 w-1.5 h-full rounded-l-2xl",
                        isDisbursement ? "bg-rose-500" : "bg-emerald-500"
                      )} />

                      <div className="flex items-center gap-4 pl-1 min-w-0 flex-1">
                        <div className={cn(
                          "p-2.5 rounded-xl flex-shrink-0",
                          isDisbursement ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {isDisbursement ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[8px] font-mono font-black text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded leading-none">
                              {tx.reference || 'VOUCHER'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {cashAcctName} &rarr; {targetAcctName}
                            </span>
                          </div>
                          
                          <h4 className="font-extrabold text-slate-900 text-xs tracking-tight truncate">
                            {cleanDesc}
                          </h4>

                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-300" />
                            {format(getSafeDate(tx.date), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <span className={cn(
                            "font-mono text-sm font-black tracking-tight block",
                            isDisbursement ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {isDisbursement ? '-' : '+'} {formatIDR(tx.totalDebit)}
                          </span>
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">
                            {isDisbursement ? 'Pengeluaran' : 'Penerimaan'}
                          </span>
                        </div>

                        {/* Quick action to delete/cancel mutasi */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTransaction(tx.id!, tx.description)}
                          className="h-9 w-9 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT PANEL: Treasury Form & Ledger Preview (5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Pencatatan & Otorisasi Kas
              </h3>
            </div>
          </div>

          <Card className="rounded-[32px] border border-slate-150/80 bg-white shadow-sm overflow-hidden p-6 relative">
            {/* Sliding gradient border accent based on Mode */}
            <div className={cn(
              "absolute top-0 inset-x-0 h-1.5 transition-all duration-300",
              mode === 'OUT' ? "bg-rose-500" : "bg-emerald-500"
            )} />

            {/* Inflow vs Outflow Selector Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg mb-5">
              <button 
                type="button"
                onClick={() => setMode('OUT')}
                className={cn(
                  "flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md transition-all",
                  mode === 'OUT' 
                    ? "bg-white text-rose-600 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Kas Keluar (Disbursement)
              </button>
              <button 
                type="button"
                onClick={() => setMode('IN')}
                className={cn(
                  "flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md transition-all",
                  mode === 'IN' 
                    ? "bg-white text-emerald-600 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Kas Masuk (Collection)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Cash Account selection indicator */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">
                  Rekening Aktif Terpilih
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                    {activeCashAccountObj ? activeCashAccountObj.name : 'Pilih rekening dari daftar di atas'}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600 font-medium">
                    Saldo: {formatIDR(selectedAccountBalance)}
                  </span>
                </div>
              </div>

              {/* Destination / Source Target COA */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  {mode === 'OUT' ? 'Alokasi Pengeluaran (Beban/Biaya/Utang)' : 'Alokasi Penerimaan (Pendapatan/Piutang)'}
                </label>
                <Select 
                  value={formData.targetAccount} 
                  onValueChange={v => setFormData(prev => ({ ...prev, targetAccount: v }))}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-11 bg-slate-50 text-xs font-bold text-slate-700 w-full focus:ring-blue-500/10 focus:bg-white transition-all">
                    <SelectValue placeholder={mode === 'OUT' ? "Pilih Akun Beban / Destination" : "Pilih Akun Pendapatan / Source"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-white border-slate-250 shadow-lg max-h-52 overflow-y-auto">
                    {targetAccounts.map(c => (
                      <SelectItem key={c.id} value={c.id!} className="text-xs font-semibold text-slate-700 h-9 rounded-lg">
                        {c.code} — {c.name} ({c.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount & Date Grid */}
              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Jumlah Nominal (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">Rp</span>
                    <Input 
                      type="number" 
                      className={cn(
                        "rounded-xl h-11 bg-slate-50 pl-9 font-bold text-xs font-mono focus:bg-white transition-all",
                        isBalanceWarning ? "border-amber-300 bg-amber-50/20 text-amber-700 focus:ring-amber-500/20" : "border-slate-200 text-slate-900 focus:ring-blue-500/10"
                      )}
                      placeholder="1500000"
                      value={formData.amount || ''}
                      onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Tanggal Efektif
                  </label>
                  <Input 
                    type="date" 
                    className="rounded-xl border-slate-200 h-11 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus-visible:ring-blue-500/10 transition-all" 
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

              </div>

              {/* Safety Balance Limit Alert Badge */}
              {isBalanceWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl flex items-start gap-2 text-amber-800 animate-in fade-in duration-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] font-semibold leading-relaxed">
                    Peringatan: Jumlah nominal pengeluaran melebihi sisa kas aktif saat ini. Transaksi tetap dapat dibukukan, namun saldo rekening akan bernilai minus.
                  </p>
                </div>
              )}

              {/* Transaction Memo / Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Identitas & Deskripsi Transaksi
                </label>
                <Input 
                  className="rounded-xl border-slate-200 h-11 bg-slate-50 focus:bg-white focus-visible:ring-blue-500/10 transition-all text-xs font-bold text-slate-900" 
                  placeholder="Misal: Pembayaran Tagihan Listrik PLN Kantor Utama"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* REAL-TIME DOUBLE-ENTRY JOURNAL LEDGER SIMULATOR PREVIEW */}
              <div className="p-4 bg-slate-950 text-white rounded-2xl space-y-3 border border-slate-900 relative overflow-hidden shadow-inner font-mono">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block">
                  SIMULASI ALUR PENJURNALAN (SAK-ETAP)
                </span>

                <div className="space-y-2 text-[10px] font-bold text-slate-300">
                  {/* Debit Row */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-950 border border-emerald-900 text-emerald-400 font-black text-[8px] px-1.5 py-0.5 rounded leading-none">
                        [D] DEBIT
                      </span>
                      <span className="truncate max-w-[150px] text-slate-100">
                        {mode === 'OUT' 
                          ? (activeTargetAccountObj?.name || 'Pilih Akun Beban...') 
                          : (activeCashAccountObj?.name || 'Pilih Rekening Kas...')}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-semibold">{formatIDR(formData.amount)}</span>
                  </div>

                  {/* Credit Row */}
                  <div className="flex items-center justify-between gap-2 pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-rose-950 border border-rose-900 text-rose-400 font-black text-[8px] px-1.5 py-0.5 rounded leading-none">
                        [K] KREDIT
                      </span>
                      <span className="truncate max-w-[150px] text-slate-400 italic">
                        {mode === 'OUT' 
                          ? (activeCashAccountObj?.name || 'Pilih Rekening Kas...') 
                          : (activeTargetAccountObj?.name || 'Pilih Akun Pendapatan...')}
                      </span>
                    </div>
                    <span className="text-rose-400 font-semibold">{formatIDR(formData.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Authorize Transaction Button */}
              <Button 
                type="submit"
                className={cn(
                  "w-full h-12 text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] border-0 flex items-center justify-center gap-2 shadow-md mt-4",
                  mode === 'OUT' 
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10 text-white" 
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10 text-white"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                Otorisasi Kas {mode === 'OUT' ? 'Keluar' : 'Masuk'}
              </Button>

            </form>

          </Card>

        </div>

      </div>

    </div>
  );
}
