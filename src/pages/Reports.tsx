import React, { useState, useEffect } from 'react';
import { subscribeToCollection } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Journal, AccountCategory } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { exportToPDF } from '../lib/reports';
import { format } from 'date-fns';
import { 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Download, 
  TrendingUp, 
  Wallet,
  Activity,
  Sparkles
} from 'lucide-react';
import { openMCPModal } from '../lib/mcp';

export default function ReportsPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [activeTab, setActiveTab] = useState<'pl' | 'bs'>('pl');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const unsubCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubJrn = subscribeToCollection<Journal>('journals', setJournals, user.uid);
    return () => { unsubCOA(); unsubJrn(); };
  }, [user]);

  // Helper to format in Indonesian Rupiah
  const formatIDR = (val: number) => {
    return "Rp " + val.toLocaleString("id-ID");
  };

  // Helper to get recursive depth for padding/indentation
  const getAccountDepth = (coa: COA): number => {
    let depth = 0;
    let current = coa;
    while (current.parentId) {
      const parent = coas.find(c => c.id === current.parentId);
      if (parent) {
        depth++;
        current = parent;
      } else {
        break;
      }
    }
    return depth;
  };

  // Helper to detect if an account is a parent node
  const isParentCoa = (coaId: string): boolean => {
    return coas.some(c => c.parentId === coaId);
  };

  // Helper to compute recursive balance
  const getCoaBalance = (coaId: string): number => {
    const coa = coas.find(c => c.id === coaId);
    if (!coa) return 0;

    // Direct posted journal entries
    const entries = journals.flatMap(j => j.entries).filter(e => e.coaId === coaId);
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    let directBalance = 0;
    if (coa.category === AccountCategory.ASSET || coa.category === AccountCategory.EXPENSE) {
      directBalance = totalDebit - totalCredit;
    } else {
      directBalance = totalCredit - totalDebit;
    }

    // Unify recursively with children balances
    const children = coas.filter(c => c.parentId === coaId);
    const childrenBalance = children.reduce((sum, child) => sum + getCoaBalance(child.id!), 0);

    return directBalance + childrenBalance;
  };

  // Helper to get true sum of a category (top-level accounts only)
  const getCategoryTotal = (category: AccountCategory): number => {
    const topLevelCoas = coas.filter(c => 
      c.category === category && 
      (!c.parentId || !coas.some(p => p.id === c.parentId))
    );
    return topLevelCoas.reduce((sum, coa) => sum + getCoaBalance(coa.id!), 0);
  };

  // Get net income
  const getNetIncome = (): number => {
    const revenueTotal = getCategoryTotal(AccountCategory.REVENUE);
    const expenseTotal = getCategoryTotal(AccountCategory.EXPENSE);
    return revenueTotal - expenseTotal;
  };

  const handleExportPDF = () => {
    if (activeTab === 'pl') {
      const title = "LAPORAN LABA RUGI (INCOME STATEMENT) - PSAK";
      const columns = ["KODE AKUN", "NAMA AKUN", "SALDO AKHIR"];
      
      const revenueCoas = coas.filter(c => c.category === AccountCategory.REVENUE).sort((a, b) => a.code.localeCompare(b.code));
      const expenseCoas = coas.filter(c => c.category === AccountCategory.EXPENSE).sort((a, b) => a.code.localeCompare(b.code));
      
      const rows: any[] = [];
      
      rows.push(["1. PENDAPATAN OPERASIONAL YIELD", "", ""]);
      revenueCoas.forEach(c => {
        const balance = getCoaBalance(c.id!);
        rows.push([`  ${c.code}`, `  ${c.name}`, formatIDR(balance)]);
      });
      rows.push(["TOTAL PENDAPATAN", "", formatIDR(getCategoryTotal(AccountCategory.REVENUE))]);
      
      rows.push(["", "", ""]);
      rows.push(["2. BEBAN OPERASIONAL & PERUSAHAAN", "", ""]);
      expenseCoas.forEach(c => {
        const balance = getCoaBalance(c.id!);
        rows.push([`  ${c.code}`, `  ${c.name}`, formatIDR(balance)]);
      });
      rows.push(["TOTAL BEBAN", "", formatIDR(getCategoryTotal(AccountCategory.EXPENSE))]);
      
      rows.push(["", "", ""]);
      rows.push(["KEUNTUNGAN BERSIH / LABA TAHUN BERJALAN", "", formatIDR(getNetIncome())]);
      
      exportToPDF(title, columns, rows, 'laporan_laba_rugi_psak');
    } else {
      const title = "LAPORAN POSISI KEUANGAN (BALANCE SHEET) - PSAK";
      const columns = ["KODE AKUN", "NAMA AKUN", "SALDO AKHIR"];
      
      const assetCoas = coas.filter(c => c.category === AccountCategory.ASSET).sort((a, b) => a.code.localeCompare(b.code));
      const liabilityCoas = coas.filter(c => c.category === AccountCategory.LIABILITY).sort((a, b) => a.code.localeCompare(b.code));
      const equityCoas = coas.filter(c => c.category === AccountCategory.EQUITY).sort((a, b) => a.code.localeCompare(b.code));
      
      const rows: any[] = [];
      
      rows.push(["1. AKTIVA / ASET (ASSETS)", "", ""]);
      assetCoas.forEach(c => {
        const balance = getCoaBalance(c.id!);
        rows.push([`  ${c.code}`, `  ${c.name}`, formatIDR(balance)]);
      });
      rows.push(["TOTAL ASET", "", formatIDR(getCategoryTotal(AccountCategory.ASSET))]);
      
      rows.push(["", "", ""]);
      rows.push(["2. UTANG / LIABILITAS (LIABILITIES)", "", ""]);
      liabilityCoas.forEach(c => {
        const balance = getCoaBalance(c.id!);
        rows.push([`  ${c.code}`, `  ${c.name}`, formatIDR(balance)]);
      });
      rows.push(["TOTAL LIABILITAS", "", formatIDR(getCategoryTotal(AccountCategory.LIABILITY))]);
      
      rows.push(["", "", ""]);
      rows.push(["3. EKUITAS / MODAL (EQUITY)", "", ""]);
      equityCoas.forEach(c => {
        const balance = getCoaBalance(c.id!);
        rows.push([`  ${c.code}`, `  ${c.name}`, formatIDR(balance)]);
      });
      rows.push(["  —", "  Laba / Rugi Berjalan (Current Earnings)", formatIDR(getNetIncome())]);
      rows.push(["TOTAL EKUITAS + LABA BERJALAN", "", formatIDR(getCategoryTotal(AccountCategory.EQUITY) + getNetIncome())]);
      
      rows.push(["", "", ""]);
      rows.push(["TOTAL LIABILITAS & EKUITAS", "", formatIDR(getCategoryTotal(AccountCategory.LIABILITY) + getCategoryTotal(AccountCategory.EQUITY) + getNetIncome())]);
      
      exportToPDF(title, columns, rows, 'laporan_neraca_keuangan_psak');
    }
  };

  const renderSection = (category: AccountCategory, isEquitySection = false) => {
    // Sort relevant COAs by their hierarchical code
    const relevantCoas = coas
      .filter(c => c.category === category)
      .sort((a, b) => a.code.localeCompare(b.code));

    const total = getCategoryTotal(category);

    const sectionTitle = 
      category === AccountCategory.ASSET ? '01. Aset (Assets)' :
      category === AccountCategory.LIABILITY ? '02. Liabilitas (Liabilities)' :
      category === AccountCategory.EQUITY ? '03. Ekuitas (Equity)' :
      category === AccountCategory.REVENUE ? '01. Pendapatan Usaha (Revenues)' :
      '02. Beban Operasional (Expenses)';

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
            {sectionTitle}
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            {relevantCoas.length} akun
          </span>
        </div>
        <div className="border border-slate-200/90 rounded-lg overflow-hidden bg-white">
          <Table>
            <TableBody>
              {relevantCoas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-slate-400 text-xs">
                    Belum ada akun terdaftar untuk kategori ini.
                  </TableCell>
                </TableRow>
              ) : (
                relevantCoas.map(coa => {
                  const balance = getCoaBalance(coa.id!);
                  const depth = getAccountDepth(coa);
                  const isParent = isParentCoa(coa.id!);
                  
                  return (
                    <TableRow 
                      key={coa.id} 
                      className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 h-10 ${
                        isParent ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      <TableCell className="py-2 text-xs font-mono tabular-nums text-slate-400 w-28 pl-4">
                        {coa.code}
                      </TableCell>
                      <TableCell 
                        className={`py-2 text-xs ${
                          isParent ? 'font-bold text-slate-900' : 'text-slate-700 font-normal'
                        }`}
                        style={{ paddingLeft: `${16 + depth * 14}px` }}
                      >
                        {coa.name}
                      </TableCell>
                      <TableCell className={`py-2 text-right font-mono tabular-nums text-xs pr-4 ${
                        isParent ? 'font-bold text-slate-900' : 'text-slate-600'
                      }`}>
                        {formatIDR(balance)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}

              {/* Extra Virtual Row for Net Income in Equity Section to balance the Balance Sheet */}
              {isEquitySection && (
                <TableRow className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 bg-emerald-50/20 h-10">
                  <TableCell className="py-2 text-xs font-mono text-emerald-600 pl-4">
                    —
                  </TableCell>
                  <TableCell className="py-2 text-xs font-semibold text-emerald-800 pl-8">
                    Laba / (Rugi) Periode Berjalan (Current Earnings)
                  </TableCell>
                  <TableCell className="py-2 text-right font-bold text-emerald-800 text-xs pr-4 font-mono tabular-nums">
                    {formatIDR(getNetIncome())}
                  </TableCell>
                </TableRow>
              )}

              {/* Section Subtotal Row */}
              <TableRow className="border-t border-slate-200 bg-slate-50/60 hover:bg-slate-50/60 h-11">
                <TableCell colSpan={2} className="py-2.5 text-xs font-bold text-slate-600 uppercase pl-4">
                  {isEquitySection ? "Total Ekuitas + Laba Berjalan" : `Total ${category}`}
                </TableCell>
                <TableCell className="py-2.5 text-right font-bold text-slate-900 text-xs pr-4 font-mono tabular-nums">
                  {isEquitySection ? formatIDR(total + getNetIncome()) : formatIDR(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Balance sheet audit indicators
  const totalAssets = getCategoryTotal(AccountCategory.ASSET);
  const totalLiabilities = getCategoryTotal(AccountCategory.LIABILITY);
  const totalEquity = getCategoryTotal(AccountCategory.EQUITY);
  const netIncome = getNetIncome();
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Laporan Akuntansi</span>
             <span aria-hidden="true">·</span>
             <span>Standar SAK ETAP Indonesia</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Laporan Keuangan Resmi</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline"
            onClick={() => openMCPModal(activeTab === 'pl' ? 'labarugi' : 'neraca')}
            className="rounded-lg border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-semibold px-3.5 h-9 transition-colors text-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Cek Ringkas (MCP)
          </Button>
          <Button 
            variant="outline"
            onClick={handleExportPDF}
            className="rounded-lg border-slate-200 bg-white text-slate-700 font-semibold px-4 h-9 hover:bg-slate-50 transition-colors text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Unduh Laporan PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pl" onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-lg border border-slate-200/80 w-fit h-auto gap-1">
          <TabsTrigger value="pl" className="rounded-md px-4 py-1.5 font-medium text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Laporan Laba Rugi
          </TabsTrigger>
          <TabsTrigger value="bs" className="rounded-md px-4 py-1.5 font-medium text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5" />
            Neraca Posisi Keuangan
          </TabsTrigger>
        </TabsList>

        {/* INCOME STATEMENT TAB */}
        <TabsContent value="pl" className="m-0 max-w-4xl bg-white p-6 md:p-8 rounded-xl border border-slate-200/90 shadow-none space-y-6">
           <div className="pb-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Laporan Laba Rugi (Income Statement)</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>Periode: Tahun Berjalan {new Date().getFullYear()}</span>
                <span aria-hidden="true">·</span>
                <span>Standar SAK ETAP</span>
              </div>
           </div>
           
           <div className="space-y-6">
             {renderSection(AccountCategory.REVENUE)}
             {renderSection(AccountCategory.EXPENSE)}
           </div>

           <div className="p-5 bg-slate-900 rounded-xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-0.5">
                 <p className="text-xs text-slate-400">Hasil Perhitungan Akhir</p>
                 <h3 className="text-base font-bold text-white tracking-tight">Laba / (Rugi) Bersih Tahun Berjalan</h3>
              </div>
              <div className="font-mono tabular-nums text-xl md:text-2xl font-bold">
                <span className={getNetIncome() >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {formatIDR(getNetIncome())}
                </span>
              </div>
           </div>
        </TabsContent>

        {/* BALANCE SHEET TAB */}
        <TabsContent value="bs" className="m-0 max-w-4xl bg-white p-6 md:p-8 rounded-xl border border-slate-200/90 shadow-none space-y-6">
           <div className="pb-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Neraca Posisi Keuangan (Balance Sheet)</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>Per Tanggal: {format(new Date(), 'dd MMMM yyyy')}</span>
                <span aria-hidden="true">·</span>
                <span>Pencatatan Ganda SAK ETAP</span>
              </div>
           </div>

           {/* Balanced Status Warning Check Card */}
           <div>
             {isBalanced ? (
               <div className="flex items-start gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                 <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                 <div className="space-y-1">
                   <span className="font-bold text-slate-900 block">Neraca Keuangan Seimbang (Balanced)</span>
                   <p className="text-slate-600">
                     Total Aktiva (Aset) sama persis dengan Total Pasiva (Liabilitas + Ekuitas + Laba Berjalan).
                   </p>
                   <div className="font-mono tabular-nums flex gap-3 text-emerald-800 font-bold pt-1">
                     <span>Aset: {formatIDR(totalAssets)}</span>
                     <span>=</span>
                     <span>Liabilitas & Ekuitas: {formatIDR(totalLiabilitiesAndEquity)}</span>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="flex items-start gap-3 p-3.5 bg-rose-50/70 border border-rose-200 rounded-lg text-rose-800 text-xs">
                 <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                 <div className="space-y-1">
                   <span className="font-bold text-slate-900 block">Neraca Keuangan Belum Seimbang</span>
                   <p className="text-slate-600">
                     Terdapat selisih dalam pencatatan double-entry. Periksa transaksi jurnal Anda.
                   </p>
                   <div className="font-mono tabular-nums flex flex-wrap gap-3 text-rose-800 font-bold pt-1">
                     <span>Aset: {formatIDR(totalAssets)}</span>
                     <span>≠</span>
                     <span>Liabilitas & Ekuitas: {formatIDR(totalLiabilitiesAndEquity)}</span>
                     <span className="ml-auto text-rose-700">Selisih: {formatIDR(Math.abs(totalAssets - totalLiabilitiesAndEquity))}</span>
                   </div>
                 </div>
               </div>
             )}
           </div>
           
           <div className="space-y-6">
             {renderSection(AccountCategory.ASSET)}
             {renderSection(AccountCategory.LIABILITY)}
             {renderSection(AccountCategory.EQUITY, true)}
           </div>

           {/* Bottom double-entry check cards */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
             <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
               <span className="text-xs text-slate-500 font-medium block">Total Sumber Aktiva</span>
               <h4 className="text-xs font-bold text-slate-700 uppercase mt-0.5">Jumlah Aset</h4>
               <p className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                 {formatIDR(totalAssets)}
               </p>
             </div>
             <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
               <span className="text-xs text-slate-500 font-medium block">Total Sumber Pasiva</span>
               <h4 className="text-xs font-bold text-slate-700 uppercase mt-0.5">Jumlah Liabilitas & Ekuitas</h4>
               <p className="font-mono tabular-nums text-lg font-bold text-slate-900 mt-1">
                 {formatIDR(totalLiabilitiesAndEquity)}
               </p>
             </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
