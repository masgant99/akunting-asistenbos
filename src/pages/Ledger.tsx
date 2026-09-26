import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  FileText,
  Calendar as CalendarIcon,
  ChevronRight,
  Filter
} from 'lucide-react';
import { subscribeToCollection } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Journal, AccountCategory } from '../types';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { exportToPDF, exportToExcel } from '../lib/reports';
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

export default function LedgerPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedCoaId, setSelectedCoaId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const unsubCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubJrn = subscribeToCollection<Journal>('journals', setJournals, user.uid);
    return () => { unsubCOA(); unsubJrn(); };
  }, [user]);

  const ledgerEntries = journals.flatMap(idx => 
    idx.entries.map(e => ({
      date: getSafeDate(idx.date),
      description: idx.description,
      reference: idx.reference,
      coaId: e.coaId,
      debit: e.debit,
      credit: e.credit
    }))
  ).filter(e => selectedCoaId === 'all' || e.coaId === selectedCoaId)
   .sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleExport = (type: 'pdf' | 'excel') => {
    const cols = ['Tanggal', 'Keterangan', 'Referensi', 'Debit (Rp)', 'Kredit (Rp)'];
    const data = ledgerEntries.map(e => [
      format(e.date, 'yyyy-MM-dd'),
      e.description,
      e.reference || '-',
      e.debit.toLocaleString('id-ID'),
      e.credit.toLocaleString('id-ID')
    ]);
    
    if (type === 'pdf') {
      exportToPDF('Laporan Buku Besar (General Ledger)', cols, data, 'buku_besar');
    } else {
      const excelData = ledgerEntries.map(e => ({
        Tanggal: format(e.date, 'yyyy-MM-dd'),
        Keterangan: e.description,
        Referensi: e.reference || '-',
        Debit: e.debit,
        Kredit: e.credit
      }));
      exportToExcel(excelData, 'buku_besar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Pembukuan Lanjutan</span>
             <span aria-hidden="true">·</span>
             <span>Metode Akrual SAK ETAP</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Buku Besar & Neraca Saldo</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={() => handleExport('pdf')} 
            className="rounded-lg border-slate-200 bg-white text-slate-700 font-semibold px-3.5 h-9 hover:bg-slate-50 text-xs shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
            Ekspor PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('excel')} 
            className="rounded-lg border-slate-200 bg-white text-slate-700 font-semibold px-3.5 h-9 hover:bg-slate-50 text-xs shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Ekspor Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="space-y-5">
        <TabsList className="bg-slate-100 p-1 rounded-lg border border-slate-200/80 w-fit h-auto gap-1">
          <TabsTrigger value="ledger" className="rounded-md px-4 py-1.5 font-medium text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all">
            Buku Besar (General Ledger)
          </TabsTrigger>
          <TabsTrigger value="trial" className="rounded-md px-4 py-1.5 font-medium text-xs text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all">
            Neraca Saldo (Trial Balance)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4 m-0">
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200/90 p-4 rounded-xl">
              <div className="flex-1 max-w-sm">
                <Select value={selectedCoaId} onValueChange={setSelectedCoaId}>
                  <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-xs">
                     <SelectValue placeholder="Semua Akun Buku Besar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg text-xs">
                    <SelectItem value="all">Semua Akun (Seluruh Mutasi)</SelectItem>
                    {coas.map(coa => (
                      <SelectItem key={coa.id} value={coa.id!}>
                        <span className="font-mono">{coa.code}</span> — {coa.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Total entri mutasi: {ledgerEntries.length}
              </div>
           </div>

           <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden mb-8">
              <Table>
                 <TableHeader className="bg-slate-50/70">
                    <TableRow className="border-b border-slate-200 h-10">
                       <TableHead className="font-semibold text-xs text-slate-600 pl-6 w-32">Tanggal</TableHead>
                       <TableHead className="font-semibold text-xs text-slate-600">Akun Perkiraan (COA)</TableHead>
                       <TableHead className="font-semibold text-xs text-slate-600">Keterangan Transaksi</TableHead>
                       <TableHead className="w-[160px] text-right font-semibold text-xs text-slate-600">Debit (Rp)</TableHead>
                       <TableHead className="w-[160px] text-right font-semibold text-xs text-slate-600 pr-6">Kredit (Rp)</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {ledgerEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-40 text-center text-xs text-slate-400 font-medium">
                          Belum ada catatan transaksi pada akun yang dipilih.
                        </TableCell>
                      </TableRow>
                    ) : ledgerEntries.map((e, idx) => {
                       const coa = coas.find(c => c.id === e.coaId);
                       return (
                         <TableRow key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors h-14">
                            <TableCell className="pl-6 font-mono text-xs text-slate-500">
                              {format(e.date, 'yyyy-MM-dd')}
                            </TableCell>
                            <TableCell>
                               <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-900">{coa?.name || '-'}</span>
                                  <span className="text-[11px] font-mono text-slate-400">{coa?.code}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700 font-normal">
                              {e.description}
                              {e.reference && (
                                <span className="text-[11px] font-mono text-slate-400 ml-2">[{e.reference}]</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-xs text-slate-800">
                              {e.debit > 0 ? `Rp ${e.debit.toLocaleString('id-ID')}` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-xs text-slate-800 pr-6">
                              {e.credit > 0 ? `Rp ${e.credit.toLocaleString('id-ID')}` : '—'}
                            </TableCell>
                         </TableRow>
                       );
                    })}
                 </TableBody>
              </Table>
           </div>
        </TabsContent>

        <TabsContent value="trial" className="m-0">
           <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
              <Table>
                 <TableHeader className="bg-slate-50/70">
                    <TableRow className="border-b border-slate-200 h-10">
                       <TableHead className="font-semibold text-xs text-slate-600 pl-6 w-32">Kode Akun</TableHead>
                       <TableHead className="font-semibold text-xs text-slate-600">Nama Akun Perkiraan</TableHead>
                       <TableHead className="w-[180px] text-right font-semibold text-xs text-slate-600">Akumulasi Debit (Rp)</TableHead>
                       <TableHead className="w-[180px] text-right font-semibold text-xs text-slate-600 pr-6">Akumulasi Kredit (Rp)</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {coas.map(coa => {
                       const relevantJournals = journals.flatMap(j => j.entries).filter(e => e.coaId === coa.id);
                       const totalDebit = relevantJournals.reduce((sum, e) => sum + e.debit, 0);
                       const totalCredit = relevantJournals.reduce((sum, e) => sum + e.credit, 0);
                       
                       if (totalDebit === 0 && totalCredit === 0) return null;

                       return (
                         <TableRow key={coa.id} className="border-b border-slate-100 h-12 hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-mono tabular-nums text-slate-500 text-xs pl-6">{coa.code}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-900">{coa.name}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-xs text-slate-800">
                              Rp {totalDebit.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-xs text-slate-800 pr-6">
                              Rp {totalCredit.toLocaleString('id-ID')}
                            </TableCell>
                         </TableRow>
                       );
                    })}
                 </TableBody>
              </Table>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
