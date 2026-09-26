import React, { useState, useEffect } from 'react';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Budget, BudgetTransaction } from '../types';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Calendar, 
  FileText,
  Search,
  Trash2,
  Edit2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Filter,
  RefreshCw,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function BudgetPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [selectedCoaId, setSelectedCoaId] = useState<string | null>(null);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'EXPENSE' | 'REVENUE'>('ALL');

  // Modals / Dialog states
  const [showAddBudgetDialog, setShowAddBudgetDialog] = useState(false);
  const [showAddTxDialog, setShowAddTxDialog] = useState(false);
  
  // Edit Budget states
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editBudgetAmount, setEditBudgetAmount] = useState('');

  // New Budget Form State
  const [newBudgetCoaId, setNewBudgetCoaId] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  
  // New Transaction Form State
  const [newTxType, setNewTxType] = useState<'Pertambahan' | 'Pengurangan'>('Pengurangan');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxDate, setNewTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const unsubCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubBdg = subscribeToCollection<Budget>('budgets', setBudgets, user.uid);
    const unsubTx = subscribeToCollection<BudgetTransaction>('budgetTransactions', setTransactions, user.uid);
    return () => { 
      unsubCOA(); 
      unsubBdg(); 
      unsubTx(); 
    };
  }, [user]);

  // Set default selected COA on first load if budgets exist
  useEffect(() => {
    if (budgets.length > 0 && !selectedCoaId) {
      setSelectedCoaId(budgets[0].coaId);
    }
  }, [budgets, selectedCoaId]);

  // Format IDR helper
  const formatIDR = (val: number) => {
    return "Rp " + val.toLocaleString("id-ID");
  };

  // Get current period (YYYY-MM)
  const currentPeriod = format(new Date(), 'yyyy-MM');

  // Handle budget creation
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBudgetCoaId || !newBudgetAmount) {
      toast.error("Harap isi semua kolom data anggaran.");
      return;
    }

    try {
      const amount = parseFloat(newBudgetAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Nominal anggaran harus berupa angka positif.");
        return;
      }

      // Check if already exists for current period
      const existing = budgets.find(b => b.coaId === newBudgetCoaId && b.period === currentPeriod);
      if (existing) {
        toast.error("Anggaran untuk akun ini sudah ditentukan di bulan ini.");
        return;
      }

      await addDocument('budgets', {
        coaId: newBudgetCoaId,
        amount,
        period: currentPeriod,
        actual: 0
      });

      toast.success("Anggaran awal berhasil ditetapkan!");
      setNewBudgetCoaId('');
      setNewBudgetAmount('');
      setShowAddBudgetDialog(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyimpan alokasi anggaran.");
    }
  };

  // Handle budget deletion (with cascading cleanup)
  const handleDeleteBudget = async (id: string, coaId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus alokasi anggaran ini? Semua riwayat transaksi anggaran terkait pos ini juga akan dihapus.")) {
      return;
    }

    try {
      // Delete budget doc
      await deleteDocument('budgets', id);

      // Cascading deletion of transactions
      const txsToDelete = transactions.filter(t => t.coaId === coaId);
      for (const tx of txsToDelete) {
        if (tx.id) {
          await deleteDocument('budgetTransactions', tx.id);
        }
      }

      toast.success("Anggaran dan riwayat transaksi terkait berhasil dihapus.");
      if (selectedCoaId === coaId) {
        setSelectedCoaId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus anggaran.");
    }
  };

  // Open Edit Budget modal
  const handleOpenEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setEditBudgetAmount(budget.amount.toString());
  };

  // Handle budget update
  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget || !editBudgetAmount) return;

    try {
      const amount = parseFloat(editBudgetAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Nominal anggaran harus berupa angka positif.");
        return;
      }

      await updateDocument('budgets', editingBudget.id!, {
        amount
      });

      toast.success("Alokasi anggaran berhasil disesuaikan!");
      setEditingBudget(null);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyesuaikan anggaran.");
    }
  };

  // Handle transaction creation
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const coaId = selectedCoaId;
    if (!coaId) {
      toast.error("Harap pilih salah satu akun anggaran terlebih dahulu.");
      return;
    }

    if (!newTxAmount || !newTxDesc || !newTxDate) {
      toast.error("Harap isi seluruh field transaksi.");
      return;
    }

    try {
      const amount = parseFloat(newTxAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Nominal transaksi harus berupa angka positif.");
        return;
      }

      await addDocument('budgetTransactions', {
        coaId,
        amount,
        type: newTxType,
        description: newTxDesc,
        date: new Date(newTxDate)
      });

      toast.success(`Transaksi ${newTxType} berhasil direkam!`);
      
      // Reset form
      setNewTxAmount('');
      setNewTxDesc('');
      setNewTxDate(format(new Date(), 'yyyy-MM-dd'));
      setShowAddTxDialog(false);
    } catch (err) {
      console.error(err);
      toast.error("Gagal merekam transaksi anggaran.");
    }
  };

  // Handle transaction deletion
  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi anggaran ini? Nilai sisa anggaran akan otomatis disesuaikan.")) {
      return;
    }

    try {
      await deleteDocument('budgetTransactions', txId);
      toast.success("Transaksi anggaran berhasil dihapus.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus transaksi.");
    }
  };

  // Calculations for specific COA
  const getBudgetStats = (coaId: string) => {
    const budget = budgets.find(b => b.coaId === coaId);
    const coa = coas.find(c => c.id === coaId);
    
    const initialAmount = budget?.amount || 0;
    
    // Filter transactions for this specific COA
    const txs = transactions.filter(t => t.coaId === coaId);
    
    const additions = txs
      .filter(t => t.type === 'Pertambahan')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const subtractions = txs
      .filter(t => t.type === 'Pengurangan')
      .reduce((sum, t) => sum + t.amount, 0);

    const adjustedLimit = initialAmount + additions;
    const actualSpent = subtractions;
    const remaining = adjustedLimit - actualSpent;
    const utilizationRate = adjustedLimit > 0 ? (actualSpent / adjustedLimit) * 100 : 0;

    return {
      budget,
      coa,
      initialAmount,
      additions,
      subtractions,
      adjustedLimit,
      actualSpent,
      remaining,
      utilizationRate,
      txs
    };
  };

  // Overall calculations for Top Dashboard Widgets
  const totalAllocated = budgets.reduce((sum, b) => {
    const stats = getBudgetStats(b.coaId);
    return sum + stats.adjustedLimit;
  }, 0);

  const totalSpent = budgets.reduce((sum, b) => {
    const stats = getBudgetStats(b.coaId);
    return sum + stats.actualSpent;
  }, 0);

  const overallRemaining = totalAllocated - totalSpent;
  const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  // Filter budgets based on search & category
  const filteredBudgets = budgets.filter(b => {
    const stats = getBudgetStats(b.coaId);
    const coaName = stats.coa?.name?.toLowerCase() || '';
    const coaCode = stats.coa?.code?.toLowerCase() || '';
    const matchesSearch = coaName.includes(searchQuery.toLowerCase()) || coaCode.includes(searchQuery.toLowerCase());
    
    if (categoryFilter === 'ALL') return matchesSearch;
    if (categoryFilter === 'EXPENSE') return matchesSearch && stats.coa?.category === 'Expense';
    if (categoryFilter === 'REVENUE') return matchesSearch && stats.coa?.category === 'Revenue';
    return matchesSearch;
  });

  // Selected Budget Stats
  const selectedStats = selectedCoaId ? getBudgetStats(selectedCoaId) : null;

  // Dynamic status classifications for budget items
  const safeBudgets = budgets.filter(b => getBudgetStats(b.coaId).utilizationRate < 80).length;
  const warningBudgets = budgets.filter(b => {
    const rate = getBudgetStats(b.coaId).utilizationRate;
    return rate >= 80 && rate <= 100;
  }).length;
  const overBudgets = budgets.filter(b => getBudgetStats(b.coaId).utilizationRate > 100).length;

  return (
    <div className="space-y-8 relative">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Perencanaan Keuangan</span>
             <span aria-hidden="true">·</span>
             <span>Tahun Anggaran {new Date().getFullYear()}</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Kontrol Anggaran & Realisasi Biaya</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            onClick={() => setShowAddBudgetDialog(true)}
            className="rounded-lg bg-blue-600 text-white font-semibold px-4 h-9 hover:bg-blue-700 transition-colors text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Alokasi Anggaran Baru
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Limits */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Pagu Alokasi Anggaran</span>
            <div className="p-1.5 bg-slate-50 text-blue-600 rounded-md">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-mono tabular-nums font-bold text-slate-900 tracking-tight leading-none">
              {formatIDR(totalAllocated)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{budgets.length} pos anggaran aktif</p>
          </div>
        </div>

        {/* Card 2: Spent */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Realisasi Pengeluaran</span>
            <div className="p-1.5 bg-slate-50 text-rose-600 rounded-md">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-mono tabular-nums font-bold text-slate-900 tracking-tight leading-none">
              {formatIDR(totalSpent)}
            </p>
            <p className="text-xs text-rose-600 font-medium mt-1">Terealisasi</p>
          </div>
        </div>

        {/* Card 3: Remaining */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Sisa Anggaran Tersedia</span>
            <div className="p-1.5 bg-slate-50 text-emerald-600 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className={cn(
              "text-xl font-mono tabular-nums font-bold tracking-tight leading-none",
              overallRemaining >= 0 ? "text-emerald-600" : "text-rose-600"
            )}>
              {formatIDR(overallRemaining)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Sisa pagu belanja</p>
          </div>
        </div>

        {/* Card 4: Utilization */}
        <div className="border border-slate-200/90 rounded-xl bg-white p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Tingkat Penyerapan</span>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-800">{overallUtilization.toFixed(1)}%</span>
          </div>
          <div className="space-y-2">
            <Progress value={Math.min(overallUtilization, 100)} className="h-1.5 bg-slate-100 rounded-full overflow-hidden" />
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>{totalSpent > totalAllocated ? 'Melebihi Anggaran' : 'Dalam Batas Aman'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Index and Search Filter Bar */}
      <div className="border border-slate-200/90 rounded-xl bg-white p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        
        {/* Health status index */}
        <div className="lg:col-span-5 flex flex-wrap items-center gap-3 border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-4">
          <div className="mr-2">
            <span className="text-xs font-semibold text-slate-800">Status Kesehatan</span>
            <p className="text-[11px] text-slate-400">Bulan {currentPeriod}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 rounded-md px-2 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-slate-700 font-mono tabular-nums">Aman: {safeBudgets}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 rounded-md px-2 py-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-slate-700 font-mono tabular-nums">Waspada: {warningBudgets}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/70 rounded-md px-2 py-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-xs font-medium text-slate-700 font-mono tabular-nums">Over: {overBudgets}</span>
            </div>
          </div>
        </div>

        {/* Live Filter Controls */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-3 w-full">
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              type="text" 
              placeholder="Cari berdasarkan nama atau kode akun..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-slate-50/50 border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-900 w-full"
            />
          </div>

          {/* Category tabs selection */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto shrink-0">
            {(['ALL', 'EXPENSE', 'REVENUE'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  categoryFilter === cat 
                    ? "bg-white text-slate-900 shadow-xs font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {cat === 'ALL' ? 'Semua' : cat === 'EXPENSE' ? 'Biaya' : 'Pendapatan'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Layout: Left List of Budgets, Right Deep Transaction Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-16">
        
        {/* LEFT PANEL: Interactive Budgets List (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Daftar Pos Anggaran ({filteredBudgets.length} Akun)
            </h3>
            <span className="text-xs text-slate-400 font-mono">Bulan {currentPeriod}</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredBudgets.length === 0 ? (
              <div className="border border-dashed border-slate-200 bg-white rounded-xl p-10 text-center">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Target className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-slate-800 text-sm mb-1">Tidak Menemukan Data Anggaran</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Silakan sesuaikan filter pencarian Anda atau tambahkan alokasi pos anggaran baru.
                </p>
                <Button 
                  onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
                  variant="outline" 
                  size="sm" 
                  className="rounded-lg px-3 h-8 text-xs font-medium"
                >
                  Reset Filter
                </Button>
              </div>
            ) : (
              filteredBudgets.map(b => {
                const stats = getBudgetStats(b.coaId);
                const isSelected = selectedCoaId === b.coaId;
                
                let barColor = "bg-emerald-500";
                let statusTextColor = "text-emerald-700";
                
                if (stats.utilizationRate > 100) {
                  barColor = "bg-rose-500";
                  statusTextColor = "text-rose-700";
                } else if (stats.utilizationRate > 80) {
                  barColor = "bg-amber-500";
                  statusTextColor = "text-amber-700";
                }

                return (
                  <div 
                    key={b.id} 
                    onClick={() => setSelectedCoaId(b.coaId)}
                    className={cn(
                      "border rounded-xl transition-all cursor-pointer p-4 bg-white",
                      isSelected 
                        ? "border-blue-600 ring-1 ring-blue-600/20 shadow-xs" 
                        : "border-slate-200/80 hover:border-slate-300"
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Budget row top: Account & action controls */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-500">
                              {stats.coa?.code}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">
                              {stats.coa?.category}
                            </span>
                          </div>
                          <h4 className="font-semibold text-slate-900 text-sm truncate">
                            {stats.coa?.name}
                          </h4>
                        </div>

                        {/* Top Right Action & Status */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className={cn("text-xs font-mono tabular-nums font-semibold", statusTextColor)}>
                            {stats.utilizationRate.toFixed(1)}% Terpakai
                          </span>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenEditBudget(b)}
                            className="h-7 w-7 text-slate-400 hover:text-slate-800 rounded-md"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteBudget(b.id!, b.coaId)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Utilization Bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-300", barColor)} 
                            style={{ width: `${Math.min(stats.utilizationRate, 100)}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 font-mono tabular-nums">
                          <span>Realisasi: <strong className="text-slate-700 font-medium">{formatIDR(stats.actualSpent)}</strong></span>
                          <span>Batas: <strong className="text-slate-700 font-medium">{formatIDR(stats.adjustedLimit)}</strong></span>
                        </div>
                      </div>

                      {/* Budget math breakdowns footer */}
                      <div className="flex flex-wrap justify-between items-center text-xs pt-2.5 border-t border-slate-100 text-slate-500">
                        <span>Alokasi Dasar: <strong className="text-slate-700 font-mono tabular-nums font-medium">{formatIDR(stats.initialAmount)}</strong></span>
                        <span>Penyesuaian: <strong className="text-slate-700 font-mono tabular-nums font-medium">+{formatIDR(stats.additions)}</strong></span>
                        <span>Sisa: <strong className={cn("font-mono tabular-nums font-semibold", stats.remaining >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatIDR(stats.remaining)}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Dynamic Math Card & Detailed Transaction logs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Detail & Mutasi Anggaran
            </h3>
            {selectedStats && (
              <Button 
                size="sm" 
                onClick={() => setShowAddTxDialog(true)}
                className="h-8 px-3 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 border-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Posting Mutasi
              </Button>
            )}
          </div>

          {!selectedStats ? (
            <div className="border border-slate-200/90 bg-white rounded-xl p-8 text-center text-slate-400">
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Info className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-slate-600 max-w-xs mx-auto leading-relaxed">
                Pilih salah satu pos anggaran di sebelah kiri untuk melihat rincian realisasi dan riwayat mutasi transaksi secara rinci.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Clean Treasury Card */}
              <div className="border border-slate-200/90 rounded-xl bg-white p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-medium text-slate-400 block mb-0.5">
                      Akun {selectedStats.coa?.code}
                    </span>
                    <h3 className="text-base font-semibold text-slate-900 tracking-tight leading-tight">
                      {selectedStats.coa?.name}
                    </h3>
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-md",
                    selectedStats.remaining < 0 
                      ? "bg-rose-50 text-rose-700 border border-rose-200/60" 
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  )}>
                    {selectedStats.remaining < 0 ? 'Melebihi Batas' : 'Sesuai Batas'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 block">Batas Maks Anggaran</span>
                    <p className="font-mono tabular-nums font-semibold text-sm text-slate-800">{formatIDR(selectedStats.adjustedLimit)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-slate-400 block">Total Penggunaan</span>
                    <p className="font-mono tabular-nums font-semibold text-sm text-rose-600">{formatIDR(selectedStats.actualSpent)}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Sisa Anggaran Tersedia</span>
                    <p className={cn(
                      "font-mono tabular-nums font-bold text-lg leading-tight mt-0.5",
                      selectedStats.remaining >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatIDR(selectedStats.remaining)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Utilisasi</span>
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-800">{selectedStats.utilizationRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Transactions History Listing */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block px-1">Riwayat Mutasi Anggaran</span>
                
                {selectedStats.txs.length === 0 ? (
                  <div className="p-8 border border-dashed border-slate-200 bg-white rounded-xl text-center text-xs text-slate-400">
                     Belum ada transaksi pengeluaran atau penyesuaian yang direkam untuk pos ini di periode sekarang.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {selectedStats.txs.map((t) => {
                      const isAddition = t.type === 'Pertambahan';
                      
                      return (
                        <div 
                          key={t.id} 
                          className="p-3.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-3 bg-white hover:border-slate-300 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-1.5 rounded-md shrink-0",
                              isAddition ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {isAddition ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                            </div>
                            <div className="space-y-0.5">
                              <h5 className="text-xs font-semibold text-slate-800 leading-tight">
                                {t.description}
                              </h5>
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {format(new Date(t.date), 'dd MMM yyyy')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className={cn(
                                "font-mono tabular-nums text-xs font-bold",
                                isAddition ? "text-emerald-600" : "text-rose-600"
                              )}>
                                {isAddition ? '+' : '-'} {formatIDR(t.amount)}
                              </span>
                              <span className="text-[10px] text-slate-400 block uppercase">
                                {t.type}
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTransaction(t.id!)}
                              className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DIALOG: Add Budget Threshold */}
      <Dialog open={showAddBudgetDialog} onOpenChange={setShowAddBudgetDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 bg-white border border-slate-150">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-950">Tetapkan Alokasi Anggaran</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Daftarkan pos pengeluaran/pendapatan operasional baru dan tentukan batasan maksimal anggaran yang dialokasikan di bulan ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBudget} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Pilih Bagan Akun (COA)</label>
              <Select value={newBudgetCoaId} onValueChange={setNewBudgetCoaId}>
                <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                  <SelectValue placeholder="Pilih Bagan Akun" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-250 rounded-xl shadow-lg">
                  {coas
                    .filter(c => c.category === 'Expense' || c.category === 'Revenue')
                    .map(coa => (
                      <SelectItem 
                        key={coa.id} 
                        value={coa.id!} 
                        className="text-xs font-bold text-slate-700 h-9"
                      >
                        {coa.code} — {coa.name} ({coa.category})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Alokasi Dana Dasar (Limit Awal)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                <Input 
                  type="number" 
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  placeholder="Contoh: 15000000" 
                  className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddBudgetDialog(false)}
                className="rounded-xl border-slate-200 font-bold text-xs h-11 px-5"
              >
                Batal
              </Button>
              <Button 
                type="submit"
                className="rounded-xl bg-blue-600 text-white font-bold text-xs h-11 px-5 hover:bg-blue-700 active:scale-95 transition-all border-0"
              >
                Tetapkan Anggaran
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Adjust / Edit Existing Budget Limit */}
      <Dialog open={!!editingBudget} onOpenChange={(open) => !open && setEditingBudget(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 bg-white border border-slate-150">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-950 flex items-center gap-2">
              <Coins className="w-5 h-5 text-blue-600" />
              Sesuaikan Alokasi Anggaran
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Ubah batas maksimal anggaran dasar bulanan untuk pos alokasi ini. Transaksi mutasi yang terdaftar akan otomatis disesuaikan terhadap nilai baru ini.
            </DialogDescription>
          </DialogHeader>

          {editingBudget && (
            <form onSubmit={handleUpdateBudget} className="space-y-5 pt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Akun Sasaran</span>
                <span className="text-xs font-extrabold text-slate-800 block mt-0.5">
                  {coas.find(c => c.id === editingBudget.coaId)?.name || 'Akun'}
                </span>
                <span className="text-[10px] font-mono text-slate-500">Kode: {coas.find(c => c.id === editingBudget.coaId)?.code}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Batas Anggaran Baru (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <Input 
                    type="number" 
                    value={editBudgetAmount}
                    onChange={(e) => setEditBudgetAmount(e.target.value)}
                    placeholder="Contoh: 20000000" 
                    className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingBudget(null)}
                  className="rounded-xl border-slate-200 font-bold text-xs h-11 px-5"
                >
                  Batal
                </Button>
                <Button 
                  type="submit"
                  className="rounded-xl bg-blue-600 text-white font-bold text-xs h-11 px-5 hover:bg-blue-700 active:scale-95 transition-all border-0"
                >
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Budget Transaction (Adjustment/Expense) */}
      <Dialog open={showAddTxDialog} onOpenChange={setShowAddTxDialog}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 bg-white border border-slate-150">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-950">Posting Transaksi Anggaran</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Catat penambahan alokasi dana atau pemotongan realisasi penggunaan untuk pos anggaran yang dipilih.
            </DialogDescription>
          </DialogHeader>

          {selectedStats && (
            <form onSubmit={handleAddTransaction} className="space-y-5 pt-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Akun Terpilih</span>
                <span className="text-xs font-extrabold text-slate-800 block mt-0.5">{selectedStats.coa?.name}</span>
                <span className="text-[10px] font-mono text-slate-500">Batas Anggaran Aktif: {formatIDR(selectedStats.adjustedLimit)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Jenis Transaksi</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewTxType('Pertambahan')}
                    className={cn(
                      "h-11 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2",
                      newTxType === 'Pertambahan' 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/10" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Pertambahan (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTxType('Pengurangan')}
                    className={cn(
                      "h-11 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2",
                      newTxType === 'Pengurangan' 
                        ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/10" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Pengurangan (-)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Nominal Transaksi (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <Input 
                    type="number" 
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    placeholder="Contoh: 1500000" 
                    className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Deskripsi / Keterangan</label>
                <Input 
                  type="text" 
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  placeholder="Misal: Pembayaran Tagihan Wifi Kantor" 
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Tanggal Transaksi</label>
                <Input 
                  type="date" 
                  value={newTxDate}
                  onChange={(e) => setNewTxDate(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
                />
              </div>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddTxDialog(false)}
                  className="rounded-xl border-slate-200 font-bold text-xs h-11 px-5"
                >
                  Batal
                </Button>
                <Button 
                  type="submit"
                  className={cn(
                    "rounded-xl text-white font-bold text-xs h-11 px-5 active:scale-95 transition-all border-0",
                    newTxType === 'Pertambahan' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  )}
                >
                  Posting Transaksi
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
