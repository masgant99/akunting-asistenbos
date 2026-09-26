import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Check, 
  FileText,
  Bot
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { subscribeToCollection, addDocument } from '../services/db';
import { COA, Journal, JournalStatus } from '../types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface MCPAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  onJournalPosted?: () => void;
}

export default function MCPAssistantModal({
  isOpen,
  onClose,
  onJournalPosted,
}: MCPAssistantModalProps) {
  const { user } = useAuth();

  const [coas, setCoas] = useState<COA[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [parsedJournal, setParsedJournal] = useState<{
    description: string;
    date: string;
    reference: string;
    entries: { coaId?: string; coaCode: string; coaName: string; debit: number; credit: number }[];
    totalDebit: number;
    totalCredit: number;
    reasoning?: string;
    confidence?: string;
  } | null>(null);

  // Subscribe to COA
  useEffect(() => {
    if (!user || !isOpen) return;
    const unsubCOA = subscribeToCollection<COA>('coa', (data) => setCoas(data), user.uid);
    return () => unsubCOA();
  }, [user, isOpen]);

  // Reset state when modal is opened or closed
  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setParsedJournal(null);
    }
  }, [isOpen]);

  // Format IDR currency
  const formatIDR = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  // Quick Preset Prompts
  const quickPrompts = [
    'Beli perlengkapan kantor tunai Rp 450.000',
    'Bayar beban sewa kantor Rp 3.000.000 via Bank',
    'Terima pendapatan jasa konsultasi Rp 7.500.000 via Bank',
    'Pelunasan piutang customer Rp 2.500.000 ke Kas',
    'Bayar tagihan listrik & internet Rp 850.000 via Kas',
  ];

  // Handle Parse AI
  const handleParsePrompt = async (inputPrompt?: string) => {
    const textToParse = inputPrompt || prompt;
    if (!textToParse.trim()) {
      toast.error('Ketik transaksi yang ingin dicatat oleh AI.');
      return;
    }

    setIsParsing(true);
    try {
      const res = await fetch('/api/mcp/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToParse,
          availableAccounts: coas.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            category: c.category,
          })),
        }),
      });

      if (!res.ok) throw new Error('Gagal menghubungi layanan AI');
      const data = await res.json();

      // Ensure coaId is attached
      const mappedEntries = (data.entries || []).map((e: any) => {
        let matched = coas.find(c => c.code === e.coaCode || c.id === e.coaId);
        if (!matched) {
          matched = coas.find(c => c.name.toLowerCase() === (e.coaName || '').toLowerCase());
        }
        if (!matched && e.coaName) {
          matched = coas.find(c => c.name.toLowerCase().includes(e.coaName.toLowerCase()));
        }
        return {
          coaId: matched?.id || e.coaId || '',
          coaCode: matched?.code || e.coaCode || '101',
          coaName: matched?.name || e.coaName || 'Kas Utama',
          debit: Number(e.debit) || 0,
          credit: Number(e.credit) || 0,
        };
      });

      const totalDeb = mappedEntries.reduce((s: number, e: any) => s + e.debit, 0);
      const totalCrd = mappedEntries.reduce((s: number, e: any) => s + e.credit, 0);

      setParsedJournal({
        description: data.description || textToParse,
        date: data.date || format(new Date(), 'yyyy-MM-dd'),
        reference: data.reference || `AI-${Math.floor(1000 + Math.random() * 9000)}`,
        entries: mappedEntries,
        totalDebit: totalDeb,
        totalCredit: totalCrd,
        reasoning: data.reasoning || 'Entri berpasangan (Double-Entry SAK ETAP).',
        confidence: data.confidence || '98%',
      });

      toast.success('AI berhasil memetakan jurnal transaksi!');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memproses transaksi dengan AI');
    } finally {
      setIsParsing(false);
    }
  };

  // Post parsed journal to Firestore
  const handlePostJournal = async () => {
    if (!parsedJournal || !user) return;

    const totalDeb = parsedJournal.entries.reduce((s, e) => s + Number(e.debit || 0), 0);
    const totalCrd = parsedJournal.entries.reduce((s, e) => s + Number(e.credit || 0), 0);

    if (totalDeb !== totalCrd || totalDeb <= 0) {
      toast.error(`Jurnal tidak seimbang! Total Debit (Rp ${totalDeb.toLocaleString('id-ID')}) != Kredit (Rp ${totalCrd.toLocaleString('id-ID')})`);
      return;
    }

    if (parsedJournal.entries.some(e => !e.coaId)) {
      toast.error('Pastikan semua akun COA sudah terpetakan dengan benar.');
      return;
    }

    setIsPosting(true);
    try {
      await addDocument('journals', {
        date: new Date(parsedJournal.date),
        description: parsedJournal.description,
        reference: parsedJournal.reference,
        status: JournalStatus.POSTED,
        totalDebit: totalDeb,
        totalCredit: totalCrd,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        entries: parsedJournal.entries.map(e => ({
          coaId: e.coaId,
          debit: Number(e.debit) || 0,
          credit: Number(e.credit) || 0,
        })),
      });

      toast.success('Jurnal berhasil dibukukan ke Buku Besar!');
      setParsedJournal(null);
      setPrompt('');
      if (onJournalPosted) onJournalPosted();
      onClose();
    } catch (err) {
      toast.error('Gagal membukukan jurnal ke database.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent 
        id="ai-journal-modal" 
        showCloseButton={false}
        className="sm:max-w-2xl md:max-w-3xl w-[94vw] max-h-[90vh] p-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col font-sans"
      >
        {/* Modal Header: Focused on AI Journal Input */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Input Jurnal by AI</h3>
                <span className="text-xs text-slate-400 font-medium">
                  · Double-Entry SAK ETAP
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pencatatan transaksi pembukuan otomatis berpasangan berbasis instruksi bahasa alami.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content: Exclusively AI Journal Input */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/40">
          {/* Natural Language Prompt Input Box */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                Instruksi Transaksi Akuntansi
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Model: SAK ETAP Engine
              </span>
            </div>

            <div className="relative">
              <Input
                placeholder="Contoh: Beli perlengkapan kantor tunai Rp 450.000 atau Bayar sewa ruko Rp 5.000.000 via Bank..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleParsePrompt();
                  }
                }}
                className="h-11 text-xs sm:text-sm pr-28 rounded-lg border-slate-200 focus:border-slate-900 focus:ring-slate-900/10 shadow-2xs bg-white"
              />
              <Button
                onClick={() => handleParsePrompt()}
                disabled={isParsing || !prompt.trim()}
                className="absolute right-1 top-1 h-9 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs"
              >
                {isParsing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                )}
                Analisis
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-slate-400">Contoh Cepat (Klik untuk Coba):</span>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(qp);
                      handleParsePrompt(qp);
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 transition-colors border border-slate-200/70 font-medium"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Parsed Result Card */}
          <AnimatePresence>
            {parsedJournal && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Result Header */}
                <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                      <span className="font-mono text-blue-300 font-semibold">
                        {parsedJournal.reference}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {parsedJournal.date}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white tracking-tight">
                      {parsedJournal.description}
                    </h4>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end gap-1.5 justify-between sm:justify-center">
                    <div className="flex items-center gap-1.5 text-xs">
                      {parsedJournal.totalDebit === parsedJournal.totalCredit && parsedJournal.totalDebit > 0 ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Seimbang
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-400 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Belum Seimbang
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-200 tabular-nums">
                      {formatIDR(parsedJournal.totalDebit)}
                    </span>
                  </div>
                </div>

                {/* AI Reasoning */}
                {parsedJournal.reasoning && (
                  <div className="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-start gap-2 text-xs text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{parsedJournal.reasoning}</span>
                  </div>
                )}

                {/* Entries Table */}
                <div className="p-4">
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="h-9">
                          <TableHead className="text-xs font-bold text-slate-600">Kode Akun</TableHead>
                          <TableHead className="text-xs font-bold text-slate-600">Nama Akun (COA)</TableHead>
                          <TableHead className="text-xs font-bold text-slate-600 text-right w-36">Debit (Rp)</TableHead>
                          <TableHead className="text-xs font-bold text-slate-600 text-right w-36">Kredit (Rp)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedJournal.entries.map((entry, idx) => (
                          <TableRow key={idx} className="h-10 hover:bg-slate-50/50">
                            <TableCell className="font-mono text-xs font-semibold text-slate-700 py-2">
                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                                {entry.coaCode}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-900 py-2">
                              {entry.coaName}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs py-2 font-semibold text-slate-900">
                              {entry.debit > 0 ? formatIDR(entry.debit) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs py-2 font-semibold text-slate-900">
                              {entry.credit > 0 ? formatIDR(entry.credit) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Summary Row */}
                        <TableRow className="bg-slate-50 font-bold border-t-2 border-slate-200">
                          <TableCell colSpan={2} className="text-xs font-bold text-slate-700 py-2.5">
                            Total Keseimbangan (Debit = Kredit)
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-900 py-2.5">
                            {formatIDR(parsedJournal.totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-900 py-2.5">
                            {formatIDR(parsedJournal.totalCredit)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParsedJournal(null)}
                      className="rounded-lg border-slate-200 text-slate-600 font-medium text-xs h-9 px-4"
                    >
                      Batal / Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={handlePostJournal}
                      disabled={isPosting || parsedJournal.totalDebit !== parsedJournal.totalCredit}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 shadow-xs"
                    >
                      {isPosting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Posting ke Jurnal Umum
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
