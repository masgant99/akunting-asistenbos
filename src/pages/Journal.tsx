import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  History,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { subscribeToCollection, addDocument } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { COA, Journal, JournalStatus, JournalEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MCPAssistantModal from '../components/MCPAssistantModal';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
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

export default function JournalPage() {
  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [expandedJournals, setExpandedJournals] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  const toggleExpand = (id: string) => {
    setExpandedJournals(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Form State
  const [journalData, setJournalData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    reference: '',
    entries: [
      { coaId: '', debit: 0, credit: 0 },
      { coaId: '', debit: 0, credit: 0 }
    ]
  });

  useEffect(() => {
    if (!user) return;
    const unsubCOA = subscribeToCollection<COA>('coa', setCoas, user.uid);
    const unsubJrn = subscribeToCollection<Journal>('journals', setJournals, user.uid);
    return () => { unsubCOA(); unsubJrn(); };
  }, [user]);

  const totalDebit = journalData.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
  const totalCredit = journalData.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleAddEntry = () => {
    setJournalData({
      ...journalData,
      entries: [...journalData.entries, { coaId: '', debit: 0, credit: 0 }]
    });
  };

  const handleRemoveEntry = (index: number) => {
    if (journalData.entries.length <= 2) return;
    const newEntries = [...journalData.entries];
    newEntries.splice(index, 1);
    setJournalData({ ...journalData, entries: newEntries });
  };

  const handleEntryChange = (index: number, field: keyof JournalEntry, value: any) => {
    const newEntries = [...journalData.entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setJournalData({ ...journalData, entries: newEntries });
  };

  const handleSubmit = async () => {
    if (!isBalanced) {
      toast.error("Entri tidak seimbang. Total Debit harus sama dengan Total Kredit.");
      return;
    }
    if (!journalData.description) {
      toast.error("Keterangan transaksi wajib diisi.");
      return;
    }
    if (journalData.entries.some(e => !e.coaId)) {
      toast.error("Seluruh baris akun harus dipilih dari daftar COA.");
      return;
    }

    try {
      await addDocument('journals', {
        ...journalData,
        date: new Date(journalData.date),
        status: JournalStatus.POSTED,
        totalDebit,
        totalCredit
      });
      toast.success("Jurnal umum berhasil diposting ke buku besar");
      setIsCreating(false);
      resetForm();
    } catch {
      toast.error("Gagal memposting jurnal");
    }
  };

  const resetForm = () => {
    setJournalData({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      reference: '',
      entries: [
        { coaId: '', debit: 0, credit: 0 },
        { coaId: '', debit: 0, credit: 0 }
      ]
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
             <span>Pembukuan Jurnal</span>
             <span aria-hidden="true">·</span>
             <span>Metode Akrual SAK ETAP</span>
           </div>
           <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
             {isCreating ? 'Form Entri Jurnal Manual' : 'Buku Jurnal Umum'}
           </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {isCreating ? (
            <Button 
              variant="outline" 
              onClick={() => setIsCreating(false)} 
              className="rounded-lg border-slate-200 text-slate-700 font-medium px-4 h-9 text-xs hover:bg-slate-50 transition-colors"
            >
               Batal
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => setMcpModalOpen(true)}
                variant="outline"
                className="h-9 px-4 rounded-lg border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Input by Ai
              </Button>
              <Button 
                onClick={() => setIsCreating(true)} 
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Entri Manual Baru
              </Button>
            </>
          )}
        </div>
      </div>

      {isCreating ? (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50/40 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-slate-600">Tanggal Transaksi</label>
                 <Input 
                   type="date" 
                   className="rounded-lg border-slate-200 bg-white h-10 text-xs focus:ring-blue-600/10 focus:border-blue-600" 
                   value={journalData.date}
                   onChange={e => setJournalData({...journalData, date: e.target.value})}
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-slate-600">Nomor Referensi / Bukti</label>
                 <Input 
                   placeholder="Contoh: BKK-001 atau INV-2026" 
                   className="rounded-lg border-slate-200 bg-white h-10 text-xs focus:ring-blue-600/10 focus:border-blue-600 font-mono"
                   value={journalData.reference}
                   onChange={e => setJournalData({...journalData, reference: e.target.value})}
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-medium text-slate-600">Keterangan / Uraian Transaksi</label>
                 <Input 
                   placeholder="Deskripsi transaksi lengkap" 
                   className="rounded-lg border-slate-200 bg-white h-10 text-xs focus:ring-blue-600/10 focus:border-blue-600"
                   value={journalData.description}
                   onChange={e => setJournalData({...journalData, description: e.target.value})}
                 />
              </div>
           </div>

           <div className="p-0 overflow-x-auto">
              <Table>
                 <TableHeader className="bg-slate-50/70">
                    <TableRow className="border-b border-slate-200 h-10">
                       <TableHead className="font-semibold text-xs text-slate-600 pl-6">Akun Perkiraan (COA)</TableHead>
                       <TableHead className="w-[200px] font-semibold text-xs text-slate-600 text-right">Debit (Rp)</TableHead>
                       <TableHead className="w-[200px] font-semibold text-xs text-slate-600 text-right">Kredit (Rp)</TableHead>
                       <TableHead className="w-[60px] pr-6"></TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {journalData.entries.map((entry, index) => (
                       <TableRow key={index} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors h-14">
                          <TableCell className="pl-6">
                             <Select value={entry.coaId} onValueChange={(v) => handleEntryChange(index, 'coaId', v)}>
                                <SelectTrigger className="rounded-lg border-slate-200 bg-white h-9 text-xs focus:ring-blue-600/10">
                                   <SelectValue placeholder="Pilih akun dari bagan akun..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-lg text-xs">
                                   {coas.map(coa => (
                                     <SelectItem key={coa.id} value={coa.id!} className="rounded-md">
                                       <span className="font-mono">{coa.code}</span> — {coa.name}
                                     </SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          </TableCell>
                          <TableCell>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">Rp</span>
                                <Input 
                                   type="number" 
                                   className="rounded-lg border-slate-200 pl-9 h-9 text-right font-mono tabular-nums text-xs text-slate-800 bg-white focus:ring-blue-600/10" 
                                   value={entry.debit || ''}
                                   placeholder="0"
                                   onChange={e => handleEntryChange(index, 'debit', parseFloat(e.target.value) || 0)}
                                   onFocus={e => e.target.select()}
                                />
                             </div>
                          </TableCell>
                          <TableCell>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">Rp</span>
                                <Input 
                                   type="number" 
                                   className="rounded-lg border-slate-200 pl-9 h-9 text-right font-mono tabular-nums text-xs text-slate-800 bg-white focus:ring-blue-600/10" 
                                   value={entry.credit || ''}
                                   placeholder="0"
                                   onChange={e => handleEntryChange(index, 'credit', parseFloat(e.target.value) || 0)}
                                   onFocus={e => e.target.select()}
                                />
                             </div>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors h-8 w-8"
                                onClick={() => handleRemoveEntry(index)}
                             >
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </TableCell>
                       </TableRow>
                    ))}
                 </TableBody>
              </Table>
           </div>

           <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100">
              <Button 
                variant="outline" 
                onClick={handleAddEntry} 
                className="rounded-lg text-xs font-medium text-blue-600 border-blue-200 bg-white hover:bg-blue-50 transition-colors h-9 px-4"
              >
                 <Plus className="w-3.5 h-3.5 mr-1.5" />
                 Tambah Baris Akun
              </Button>

              <div className="flex flex-wrap gap-8 items-center justify-end">
                 <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Total Debit</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      Rp {totalDebit.toLocaleString('id-ID')}
                    </p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Total Kredit</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      Rp {totalCredit.toLocaleString('id-ID')}
                    </p>
                 </div>
                 <div className="flex items-center border-l border-slate-200 pl-8">
                    {isBalanced ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                         <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                         <span>Jurnal Seimbang</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                         <AlertCircle className="w-4 h-4 text-amber-600" />
                         <span>
                           {totalDebit !== totalCredit ? `Selisih: Rp ${Math.abs(totalDebit - totalCredit).toLocaleString('id-ID')}` : 'Entri Kosong'}
                         </span>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="p-6 flex justify-end gap-3 bg-white">
              <Button 
                onClick={handleSubmit} 
                disabled={!isBalanced} 
                className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                 <CheckCircle2 className="w-4 h-4 mr-2" />
                 Posting ke Jurnal Umum
              </Button>
           </div>
        </div>
      ) : (
        <div className="space-y-3">
           {journals.map((j) => {
             const isExpanded = !!expandedJournals[j.id!];
             return (
               <div key={j.id} className="bg-white border border-slate-200/90 rounded-xl overflow-hidden transition-all duration-200">
                  <div 
                    onClick={() => toggleExpand(j.id!)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                     <div className="flex gap-4 items-center">
                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                           <span className="text-[10px] uppercase font-medium text-slate-400 leading-none mb-0.5">{format(getSafeDate(j.date), 'MMM')}</span>
                           <span className="text-lg font-bold font-mono text-slate-800 leading-none">{format(getSafeDate(j.date), 'dd')}</span>
                        </div>
                        <div>
                           <h4 className="font-semibold text-slate-900 text-sm leading-snug">{j.description}</h4>
                           <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                              <span className="font-mono">{j.reference || 'GL-POST'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-600 font-medium">Terposting</span>
                              <span aria-hidden="true">·</span>
                              <span>{j.entries.length} baris akun</span>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-6 justify-between md:justify-end">
                        <div className="text-right">
                           <p className="text-xs text-slate-400 font-medium mb-0.5">Total Mutasi</p>
                           <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                             Rp {(j.totalDebit || 0).toLocaleString('id-ID')}
                           </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-slate-700 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(j.id!);
                          }}
                        >
                           <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} />
                        </Button>
                     </div>
                  </div>

                  {/* Expandable Line-item Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                      <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow className="h-8 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                              <TableHead className="pl-4">Kode COA</TableHead>
                              <TableHead>Nama Akun</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right pr-4">Kredit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {j.entries.map((entry, idx) => {
                              const coa = coas.find(c => c.id === entry.coaId);
                              return (
                                <TableRow key={idx} className="h-9 border-b border-slate-100 text-xs">
                                  <TableCell className="font-mono text-slate-500 pl-4">{coa?.code || '-'}</TableCell>
                                  <TableCell className="font-medium text-slate-800">{coa?.name || 'Akun Tidak Ditemukan'}</TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-slate-700">
                                    {entry.debit > 0 ? `Rp ${entry.debit.toLocaleString('id-ID')}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums text-slate-700 pr-4">
                                    {entry.credit > 0 ? `Rp ${entry.credit.toLocaleString('id-ID')}` : '-'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
               </div>
             );
           })}
           {journals.length === 0 && (
             <div className="py-20 text-center bg-white rounded-xl border border-dashed border-slate-200">
                <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-xs font-semibold text-slate-600">Belum Ada Catatan Jurnal</p>
                <p className="text-xs text-slate-400 mt-1">Gunakan tombol "Input by Ai" atau "Entri Manual Baru" untuk memposting transaksi pertama.</p>
             </div>
           )}
        </div>
      )}

      {/* MCP Assistant Modal */}
      <MCPAssistantModal
        isOpen={mcpModalOpen}
        onClose={() => setMcpModalOpen(false)}
        initialTab="journal"
      />
    </div>
  );
}
