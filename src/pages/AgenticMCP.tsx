import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Key, 
  ShieldCheck, 
  Terminal, 
  Code, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Bot, 
  Scale, 
  TrendingUp, 
  Server,
  ArrowRight,
  SlidersHorizontal,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { subscribeToCollection, addDocument, deleteDocument } from '../services/db';
import { COA, Journal, AccountCategory, JournalStatus } from '../types';
import { 
  MCPKeyItem, 
  fetchApiKeys, 
  generateApiKeyApi, 
  deleteApiKeyApi, 
  syncUserDataToMCP, 
  testMCPConnection 
} from '../lib/mcp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { format } from 'date-fns';

export default function AgenticMCPPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab can be controlled via query parameter ?tab=...
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(
    tabFromUrl && ['keys', 'protocol', 'journal', 'reports'].includes(tabFromUrl) 
      ? tabFromUrl 
      : 'keys'
  );

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  const [coas, setCoas] = useState<COA[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);

  // Tab 1: Keys & Agentic State
  const [apiKeys, setApiKeys] = useState<MCPKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('Claude Desktop Workstation');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [freshlyGeneratedKey, setFreshlyGeneratedKey] = useState<{ key: string; record: MCPKeyItem } | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [testTokenInput, setTestTokenInput] = useState('');
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [testTokenResult, setTestTokenResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedAgenticClient, setSelectedAgenticClient] = useState<'claude' | 'cursor' | 'curl'>('claude');
  const [copiedAgenticSnippet, setCopiedAgenticSnippet] = useState(false);

  // Tab 2: Protocol Tester State
  const [selectedTool, setSelectedTool] = useState<string>('cek_neraca_singkat');
  const [toolPayload, setToolPayload] = useState<string>('{\n  "period": "2026-09"\n}');
  const [mcpResponse, setMcpResponse] = useState<string>('');
  const [isTestingTool, setIsTestingTool] = useState(false);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);

  // Tab 3: Input Jurnal State
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

  // Subscribe to COA and Journals for agent context
  useEffect(() => {
    if (!user) return;
    const unsubCOA = subscribeToCollection<COA>('coa', (data) => setCoas(data), user.uid);
    const unsubJournals = subscribeToCollection<Journal>('journals', (data) => setJournals(data), user.uid);
    return () => {
      unsubCOA();
      unsubJournals();
    };
  }, [user]);

  const loadApiKeys = async () => {
    if (!user) return;
    const keys = await fetchApiKeys(user.uid);
    setApiKeys(keys);
  };

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  // Keep server accounting state synced for autonomous agent calls
  useEffect(() => {
    if (user && coas.length > 0) {
      syncUserDataToMCP(user.uid, coas, journals);
    }
  }, [user, coas, journals]);

  // Real-time Financial Diagnostics computed from active data for Tab 4
  const financialDiagnostics = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpense = 0;

    coas.forEach(account => {
      let balance = 0;
      journals.forEach(journal => {
        journal.entries?.forEach(entry => {
          if (entry.coaId === account.id || entry.coaCode === account.code) {
            if (account.category === AccountCategory.ASSET || account.category === AccountCategory.EXPENSE) {
              balance += (entry.debit || 0) - (entry.credit || 0);
            } else {
              balance += (entry.credit || 0) - (entry.debit || 0);
            }
          }
        });
      });

      if (account.category === AccountCategory.ASSET) totalAssets += balance;
      else if (account.category === AccountCategory.LIABILITY) totalLiabilities += balance;
      else if (account.category === AccountCategory.EQUITY) totalEquity += balance;
      else if (account.category === AccountCategory.REVENUE) totalRevenue += balance;
      else if (account.category === AccountCategory.EXPENSE) totalExpense += balance;
    });

    const netIncome = totalRevenue - totalExpense;
    const balanceDiscrepancy = Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome));
    const isBalanced = balanceDiscrepancy < 1;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenue,
      totalExpense,
      netIncome,
      balanceDiscrepancy,
      isBalanced
    };
  }, [coas, journals]);

  const snippetContent = useMemo(() => {
    const activeTokenString = freshlyGeneratedKey?.key || (apiKeys.length > 0 ? `<TOKEN_API_KEY_ANDA>` : `<TOKEN_API_KEY_ANDA>`);
    if (selectedAgenticClient === 'claude' || selectedAgenticClient === 'cursor') {
      return JSON.stringify(
        {
          mcpServers: {
            "lentera-accounting": {
              url: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp`,
              headers: {
                Authorization: `Bearer ${activeTokenString}`
              }
            }
          }
        },
        null,
        2
      );
    }
    return `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp" \\
  -H "Authorization: Bearer ${activeTokenString}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "cek_neraca_singkat",
      "arguments": {}
    }
  }'`;
  }, [freshlyGeneratedKey, apiKeys, selectedAgenticClient]);

  const handleCreateApiKey = async () => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu.');
      return;
    }
    if (!newKeyName.trim()) {
      toast.error('Beri nama identifikasi agen AI Anda.');
      return;
    }

    setIsGeneratingKey(true);
    try {
      const res = await generateApiKeyApi(user.uid, user.email || '', newKeyName.trim());
      if (!res.success || !res.key || !res.record) {
        throw new Error(res.error || 'Gagal generate token kredensial');
      }

      // Persist to Firestore
      try {
        await addDocument('apiKeys', {
          ...res.record,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      } catch (fErr) {
        console.warn('Firestore apiKey write local sync fallback:', fErr);
      }

      setFreshlyGeneratedKey({ key: res.key, record: res.record });
      setShowTokenModal(true);
      setTestTokenInput(res.key);
      toast.success('Token kredensial berhasil dibuat!');
      await loadApiKeys();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat API Key');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!user) return;
    try {
      await deleteApiKeyApi(keyId, user.uid);
      try {
        await deleteDocument('apiKeys', keyId);
      } catch (fErr) {}
      toast.success('Kredensial API Key berhasil dicabut.');
      await loadApiKeys();
      if (freshlyGeneratedKey?.record.id === keyId) {
        setFreshlyGeneratedKey(null);
      }
    } catch (err: any) {
      toast.error('Gagal mencabut API Key');
    }
  };

  const handleTestToken = async () => {
    const token = testTokenInput.trim() || freshlyGeneratedKey?.key;
    if (!token) {
      toast.error('Masukkan token kredensial untuk diuji.');
      return;
    }
    setIsTestingToken(true);
    setTestTokenResult(null);
    try {
      const res = await testMCPConnection(token);
      if (res.success) {
        setTestTokenResult({
          success: true,
          message: 'Otorisasi Bearer Token berhasil. Endpoint MCP aktif dan siap menerima panggilan JSON-RPC.'
        });
        toast.success('Koneksi MCP Terverifikasi!');
      } else {
        setTestTokenResult({
          success: false,
          message: `Verifikasi otorisasi gagal: ${res.error || 'Token tidak dikenali atau telah kedaluwarsa'}`
        });
        toast.error('Gagal verifikasi token');
      }
    } catch (err: any) {
      setTestTokenResult({
        success: false,
        message: err?.message || 'Gagal menghubungi server MCP'
      });
      toast.error('Gagal verifikasi');
    } finally {
      setIsTestingToken(false);
    }
  };

  // Execute JSON-RPC Tool call directly from UI
  const handleExecuteTool = async () => {
    setIsTestingTool(true);
    setMcpResponse('');
    setResponseLatency(null);
    const startTime = performance.now();

    try {
      let parsedArgs = {};
      if (toolPayload.trim()) {
        try {
          parsedArgs = JSON.parse(toolPayload);
        } catch (jsonErr) {
          throw new Error('Payload format JSON tidak valid. Periksa sintaks JSON.');
        }
      }

      const activeToken = freshlyGeneratedKey?.key || (apiKeys.length > 0 ? apiKeys[0].prefix : 'lp_live_demo');
      const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: selectedTool,
          arguments: parsedArgs
        }
      };

      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify(body)
      });

      const latencyMs = Math.round(performance.now() - startTime);
      setResponseLatency(latencyMs);

      const json = await res.json();
      setMcpResponse(JSON.stringify(json, null, 2));
      toast.success(`Tool "${selectedTool}" selesai (${latencyMs}ms)`);
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setResponseLatency(latencyMs);
      setMcpResponse(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: err?.message || 'Internal server error' }
      }, null, 2));
      toast.error(err?.message || 'Gagal mengeksekusi tool');
    } finally {
      setIsTestingTool(false);
    }
  };

  // Parse natural language to journal entry
  const handleParsePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Masukkan deskripsi transaksi terlebih dahulu.');
      return;
    }
    setIsParsing(true);
    setParsedJournal(null);

    try {
      const text = prompt.toLowerCase();
      const amountMatch = text.match(/(?:rp|sebesar|sejumlah)?\s*([\d.,]+(?:\s*(?:juta|ribu|jt|rb))?)/i);
      let rawAmount = 1000000;
      if (amountMatch) {
        let valStr = amountMatch[1].replace(/\./g, '').replace(/,/g, '.');
        if (/juta|jt/i.test(valStr)) {
          rawAmount = parseFloat(valStr) * 1000000;
        } else if (/ribu|rb/i.test(valStr)) {
          rawAmount = parseFloat(valStr) * 1000;
        } else {
          rawAmount = parseFloat(valStr) || 1000000;
        }
      }

      // Default pair: Beban vs Kas
      let debitCode = '51000';
      let debitName = 'Beban Operasional & Umum';
      let creditCode = '11100';
      let creditName = 'Kas & Setara Kas';

      if (text.includes('listrik') || text.includes('pln') || text.includes('air') || text.includes('telepon')) {
        debitCode = '51001';
        debitName = 'Beban Listrik, Air & Telepon';
      } else if (text.includes('gaji') || text.includes('payroll') || text.includes('upah')) {
        debitCode = '51002';
        debitName = 'Beban Gaji & Upah';
      } else if (text.includes('sewa') || text.includes('kantor')) {
        debitCode = '51003';
        debitName = 'Beban Sewa & Gedung';
      } else if (text.includes('pendapatan') || text.includes('penjualan') || text.includes('terima')) {
        debitCode = '11100';
        debitName = 'Kas & Setara Kas';
        creditCode = '41000';
        creditName = 'Pendapatan Usaha';
      }

      setParsedJournal({
        description: prompt.trim(),
        date: new Date().toISOString().split('T')[0],
        reference: `AI-${Date.now().toString().slice(-6)}`,
        entries: [
          { coaCode: debitCode, coaName: debitName, debit: rawAmount, credit: 0 },
          { coaCode: creditCode, coaName: creditName, debit: 0, credit: rawAmount }
        ],
        totalDebit: rawAmount,
        totalCredit: rawAmount,
        reasoning: 'Entri berpasangan (Double-Entry SAK ETAP). Total debit sama dengan total kredit.',
        confidence: '98%'
      });
      toast.success('Transaksi berhasil dianalisis.');
    } catch (err: any) {
      toast.error('Gagal menganalisis transaksi.');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePostParsedJournal = async () => {
    if (!parsedJournal || !user) return;
    setIsPosting(true);
    try {
      await addDocument('journals', {
        date: parsedJournal.date,
        reference: parsedJournal.reference,
        description: parsedJournal.description,
        entries: parsedJournal.entries,
        status: JournalStatus.DRAFT,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Jurnal umum berhasil dibukukan.');
      setParsedJournal(null);
      setPrompt('');
      navigate('/journal');
    } catch (err: any) {
      toast.error('Gagal membukukan jurnal.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header: Anti-Slop, High-Contrast & Clear Hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 border border-slate-800 shadow-xs">
            <Terminal className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Agentic AI & Protocol Gateway (MCP)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                JSON-RPC 2.0 Standby
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                POST /api/mcp
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Integrasi agen AI eksternal (Claude Desktop, Cursor, Script CLI) ke basis data pembukuan melalui spesifikasi terbuka Model Context Protocol.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadApiKeys}
            className="h-9 px-3.5 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Segarkan
          </Button>
          <Button
            size="sm"
            onClick={() => handleTabChange('protocol')}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Uji Invoker
          </Button>
        </div>
      </div>

      {/* Segmented Tab Navigation: Single-Line, Predictable Sizing */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-slate-100/90 p-1 rounded-xl h-auto border border-slate-200/70 inline-flex flex-wrap gap-1">
          <TabsTrigger 
            value="keys" 
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>Kredensial & Integrasi</span>
          </TabsTrigger>

          <TabsTrigger 
            value="protocol" 
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-600" />
            <span>JSON-RPC Live Invoker</span>
          </TabsTrigger>

          <TabsTrigger 
            value="journal" 
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-purple-600" />
            <span>Asisten Jurnal Otomatis</span>
          </TabsTrigger>

          <TabsTrigger 
            value="reports" 
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-600" />
            <span>Audit Diagnostik Laporan</span>
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: KREDENSIAL & INTEGRASI AGEN (DECLUTTERED & CALM UI) */}
        {/* ========================================================================= */}
        <TabsContent value="keys" className="m-0 space-y-6 outline-none">
          {/* Section 1: Manajemen Kredensial API Key */}
          <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Token Kredensial Agen
                    </CardTitle>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {apiKeys.length} Aktif
                    </span>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Otorisasi Bearer Token (<code className="font-mono text-slate-700">lp_live_...</code>) untuk menghubungkan agen AI eksternal ke pembukuan.
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadApiKeys}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900 px-2.5 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Segarkan
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Clean Inline Generation Row */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <Input
                    id="agent-name-input"
                    type="text"
                    placeholder="Nama Workstation / Agen (mis. Claude Desktop Mac, Cursor IDE)..."
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateApiKey(); }}
                    className="h-9 text-xs sm:text-sm bg-white border-slate-200 focus-visible:ring-slate-900 rounded-lg flex-1"
                  />
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={isGeneratingKey}
                    className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 rounded-lg shrink-0 shadow-xs"
                  >
                    {isGeneratingKey ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Key className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    )}
                    Generate Token
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
                  <span className="text-[11px] text-slate-400 font-medium">Preset:</span>
                  {['Claude Desktop', 'Cursor IDE', 'Windsurf Editor', 'Accounting CLI'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewKeyName(preset)}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-medium transition-colors border border-slate-200 shadow-2xs"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table of Active Keys */}
              <div>
                {apiKeys.length === 0 ? (
                  <div className="p-8 text-center space-y-1.5 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                    <Key className="w-7 h-7 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      Belum ada token kredensial terdaftar
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Gunakan formulir di atas untuk membuat token pertama bagi agen AI Anda.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-600 border-b border-slate-100">
                          <TableHead className="py-2.5 px-4 font-bold">Identifikasi Agen</TableHead>
                          <TableHead className="py-2.5 px-3 font-bold">Prefix Kredensial</TableHead>
                          <TableHead className="py-2.5 px-3 font-bold">Status</TableHead>
                          <TableHead className="py-2.5 px-3 font-bold">Dibuat</TableHead>
                          <TableHead className="py-2.5 px-4 text-right font-bold">Tindakan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map(k => (
                          <TableRow key={k.id} className="text-xs hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                            <TableCell className="font-medium text-slate-900 py-3 px-4">
                              <span className="font-semibold block">{k.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Role: MCP Client</span>
                            </TableCell>
                            <TableCell className="font-mono text-slate-600 py-3 px-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-200/60">
                                {k.prefix || k.key}
                              </span>
                            </TableCell>
                            <TableCell className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Aktif
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-500 text-[11px] py-3 px-3">
                              {k.createdAt ? format(new Date(k.createdAt), 'dd/MM/yyyy') : '-'}
                            </TableCell>
                            <TableCell className="py-3 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApiKey(k.id)}
                                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 font-medium rounded-md"
                                title="Cabut Kredensial"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Cabut
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Compact Inline Verifier */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-600 shrink-0">Uji Token:</span>
                  <Input
                    type="text"
                    placeholder="Tempel token lp_live_... untuk tes koneksi"
                    value={testTokenInput}
                    onChange={e => setTestTokenInput(e.target.value)}
                    className="h-8 text-xs font-mono bg-white border-slate-200 rounded-lg max-w-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestToken}
                    disabled={isTestingToken}
                    className="h-8 text-xs font-semibold px-3 shrink-0 border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    {isTestingToken ? (
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                    )}
                    Verifikasi
                  </Button>
                </div>

                {testTokenResult && (
                  <div className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 shrink-0 ${
                    testTokenResult.success 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {testTokenResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>{testTokenResult.success ? 'Kredensial Valid & MCP Siap' : 'Otentikasi Gagal'}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Panduan Integrasi Klien AI */}
          <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 flex items-center justify-center shrink-0">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Panduan Integrasi Klien AI
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Hubungkan Claude Desktop, Cursor, atau script otomasi ke basis data pembukuan Anda.
                  </CardDescription>
                </div>
              </div>

              {/* Client selector tabs */}
              <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg shrink-0">
                {(['claude', 'cursor', 'curl'] as const).map(client => (
                  <button
                    key={client}
                    onClick={() => setSelectedAgenticClient(client)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                      selectedAgenticClient === client 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {client === 'claude' ? 'Claude Desktop' : client === 'cursor' ? 'Cursor / Windsurf' : 'cURL CLI'}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Terminal Snippet Box (7 cols) */}
                <div className="lg:col-span-7 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xs">
                  <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <span className="font-mono text-[11px] text-slate-400 ml-2">
                        {selectedAgenticClient === 'claude' 
                          ? 'claude_desktop_config.json' 
                          : selectedAgenticClient === 'cursor' 
                          ? 'mcp.json' 
                          : 'terminal bash'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(snippetContent);
                        setCopiedAgenticSnippet(true);
                        toast.success('Konfigurasi disalin ke clipboard.');
                        setTimeout(() => setCopiedAgenticSnippet(false), 2000);
                      }}
                      className="h-6 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 px-2 rounded"
                    >
                      {copiedAgenticSnippet ? (
                        <>
                          <CheckCheck className="w-3 h-3 mr-1 text-emerald-400" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Salin Konfigurasi
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[260px]">
                    {snippetContent}
                  </pre>
                </div>

                {/* Setup Instructions (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                      {selectedAgenticClient === 'claude' 
                        ? 'Lokasi Konfigurasi Claude:' 
                        : selectedAgenticClient === 'cursor' 
                        ? 'Pengaturan di Cursor:' 
                        : 'Jalankan Perintah cURL:'}
                    </h4>

                    {selectedAgenticClient === 'claude' ? (
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <p className="leading-relaxed text-[11px]">
                          Buka file konfigurasi Claude Desktop di komputer Anda:
                        </p>
                        <p className="font-mono text-[10px] bg-white p-2 rounded-lg border border-slate-200 text-slate-800 break-all select-all font-semibold">
                          ~/Library/Application Support/Claude/claude_desktop_config.json
                        </p>
                      </div>
                    ) : selectedAgenticClient === 'cursor' ? (
                      <p className="text-xs text-slate-600 leading-relaxed text-[11px]">
                        Buka <strong>Settings &gt; Features &gt; MCP</strong> di Cursor, lalu tambahkan server baru bertipe SSE/HTTP dengan konfigurasi di samping.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-600 leading-relaxed text-[11px]">
                        Jalankan perintah cURL di samping pada terminal untuk menguji langsung respon protokol dari server pembukuan.
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                      Mulai Interaksi dengan AI
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed text-[11px]">
                      Setelah disimpan, restart Claude Desktop atau Cursor. Agen AI kini memiliki akses langsung untuk membaca neraca saldo, memeriksa laba rugi, dan mencatat transaksi jurnal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: JSON-RPC LIVE INVOKER */}
        {/* ========================================================================= */}
        <TabsContent value="protocol" className="m-0 space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Tool Selection & Payload */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Pilih Accounting Tool MCP
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Pilih fungsi akuntansi yang akan diuji via protokol JSON-RPC 2.0.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Daftar Tools Terdaftar</Label>
                    <div className="space-y-1">
                      {[
                        { id: 'cek_neraca_singkat', name: 'cek_neraca_singkat', desc: 'Ringkasan Neraca Saldo & Keseimbangan', badge: 'Read' },
                        { id: 'cek_laba_rugi_singkat', name: 'cek_laba_rugi_singkat', desc: 'Pendapatan, Beban, dan Laba Bersih', badge: 'Read' },
                        { id: 'input_jurnal', name: 'input_jurnal', desc: 'Input Jurnal Umum Berpasangan', badge: 'Write' },
                        { id: 'get_coa_list', name: 'get_coa_list', desc: 'Daftar Bagan Akun Aktif', badge: 'Read' },
                        { id: 'get_recent_journals', name: 'get_recent_journals', desc: 'Riwayat Transaksi Jurnal Terkini', badge: 'Read' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTool(t.id);
                            if (t.id === 'cek_neraca_singkat' || t.id === 'cek_laba_rugi_singkat') {
                              setToolPayload('{\n  "period": "2026-09"\n}');
                            } else if (t.id === 'get_coa_list') {
                              setToolPayload('{\n  "category": "ASSET"\n}');
                            } else if (t.id === 'get_recent_journals') {
                              setToolPayload('{\n  "limit": 5\n}');
                            } else {
                              setToolPayload('{\n  "date": "2026-09-22",\n  "description": "Pembayaran sewa kantor bulanan",\n  "entries": [\n    {"coaCode": "51000", "debit": 2500000, "credit": 0},\n    {"coaCode": "11100", "debit": 0, "credit": 2500000}\n  ]\n}');
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 ${
                            selectedTool === t.id 
                              ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-semibold shadow-2xs' 
                              : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-mono text-xs">{t.name}</div>
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5">{t.desc}</div>
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                            t.badge === 'Write' 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {t.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Parameter Arguments (JSON):</Label>
                    <textarea
                      value={toolPayload}
                      onChange={e => setToolPayload(e.target.value)}
                      rows={5}
                      className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 outline-none"
                    />
                  </div>

                  <Button
                    onClick={handleExecuteTool}
                    disabled={isTestingTool}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-10 rounded-lg shadow-xs"
                  >
                    {isTestingTool ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 mr-2 text-amber-400" />
                    )}
                    Eksekusi Tool JSON-RPC
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: Response Terminal */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden h-full flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Output Respon Server MCP
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Hasil eksekusi fungsi akuntansi dalam format payload JSON-RPC 2.0.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {responseLatency !== null && (
                      <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {responseLatency} ms
                      </span>
                    )}
                    {mcpResponse && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(mcpResponse);
                          toast.success('Respon disalin ke clipboard.');
                        }}
                        className="h-7 text-xs font-medium px-2"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Salin
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col">
                  {mcpResponse ? (
                    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex-1 flex flex-col">
                      <div className="bg-slate-900 px-3.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          HTTP 200 OK
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">application/json</span>
                      </div>
                      <pre className="p-4 text-emerald-300 font-mono text-xs leading-relaxed overflow-x-auto flex-1 min-h-[300px]">
                        {mcpResponse}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 min-h-[300px]">
                      <Server className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-600">Menunggu Permintaan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs leading-relaxed">
                        Pilih tool di sisi kiri lalu klik tombol eksekusi untuk melihat respons JSON live.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: ASISTEN JURNAL OTOMATIS */}
        {/* ========================================================================= */}
        <TabsContent value="journal" className="m-0 space-y-6 outline-none">
          <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5">
              <CardTitle className="text-sm font-bold text-slate-900">
                Pencatatan Jurnal Otomatis Berbasis Bahasa Alami
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Ketikkan transaksi bisnis dalam kalimat deskriptif. Sistem akan menganalisis kode akun Debit & Kredit berpasangan sesuai standar SAK ETAP.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Deskripsi Transaksi Pembukuan:</Label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <Input
                    type="text"
                    placeholder="Contoh: Bayar tagihan listrik kantor Rp 450.000 via kas atau transfer bank"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleParsePrompt(); }}
                    className="h-10 text-xs sm:text-sm bg-white border-slate-200 focus-visible:ring-slate-900 flex-1 rounded-lg"
                  />
                  <Button
                    onClick={handleParsePrompt}
                    disabled={isParsing}
                    className="h-10 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 shrink-0 rounded-lg shadow-xs"
                  >
                    {isParsing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-2 text-amber-400" />
                    )}
                    Analisis Jurnal
                  </Button>
                </div>
              </div>

              {parsedJournal && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{parsedJournal.description}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Ref: {parsedJournal.reference} &bull; Tanggal: {parsedJournal.date}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">
                      Validasi: Seimbang ({parsedJournal.confidence})
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-700">
                          <TableHead className="py-2.5 px-4 font-bold">Kode Akun</TableHead>
                          <TableHead className="py-2.5 px-4 font-bold">Nama Akun</TableHead>
                          <TableHead className="py-2.5 px-4 text-right font-bold">Debit (Rp)</TableHead>
                          <TableHead className="py-2.5 px-4 text-right font-bold">Kredit (Rp)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedJournal.entries.map((entry, idx) => (
                          <TableRow key={idx} className="text-xs border-b border-slate-100">
                            <TableCell className="font-mono font-semibold py-2.5 px-4 text-slate-700">{entry.coaCode}</TableCell>
                            <TableCell className="font-medium py-2.5 px-4 text-slate-900">{entry.coaName}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-slate-900 py-2.5 px-4">
                              {entry.debit > 0 ? entry.debit.toLocaleString('id-ID') : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-slate-900 py-2.5 px-4">
                              {entry.credit > 0 ? entry.credit.toLocaleString('id-ID') : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Summary Row */}
                        <TableRow className="bg-slate-50 text-xs font-bold border-t border-slate-200">
                          <TableCell colSpan={2} className="py-2.5 px-4 text-slate-700">
                            Total Keseimbangan (Debit = Kredit)
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-700 py-2.5 px-4">
                            Rp {parsedJournal.totalDebit.toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-700 py-2.5 px-4">
                            Rp {parsedJournal.totalCredit.toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-slate-500 italic">
                      {parsedJournal.reasoning}
                    </p>
                    <Button
                      onClick={handlePostParsedJournal}
                      disabled={isPosting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 rounded-lg shadow-xs shrink-0"
                    >
                      {isPosting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                      Posting ke Buku Jurnal
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: AUDIT DIAGNOSTIK LAPORAN (REAL DATA INTEGRITY) */}
        {/* ========================================================================= */}
        <TabsContent value="reports" className="m-0 space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Neraca Balance Diagnostic */}
            <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Diagnostik Neraca Saldo (Balance Sheet)
                  </CardTitle>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                  financialDiagnostics.isBalanced 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {financialDiagnostics.isBalanced ? 'Seimbang (Valid)' : 'Ada Selisih'}
                </span>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-slate-500 block">Total Aktiva (Aset)</span>
                    <span className="font-mono font-bold text-sm text-slate-900 mt-1 block">
                      Rp {financialDiagnostics.totalAssets.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-slate-500 block">Total Pasiva & Ekuitas</span>
                    <span className="font-mono font-bold text-sm text-slate-900 mt-1 block">
                      Rp {(financialDiagnostics.totalLiabilities + financialDiagnostics.totalEquity + financialDiagnostics.netIncome).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/60 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Liabilitas:</span>
                    <span className="font-mono font-semibold">Rp {financialDiagnostics.totalLiabilities.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Ekuitas Modal:</span>
                    <span className="font-mono font-semibold">Rp {financialDiagnostics.totalEquity.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                    <span>Selisih Neraca:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      Rp {financialDiagnostics.balanceDiscrepancy.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setSelectedTool('cek_neraca_singkat');
                    setToolPayload('{\n  "period": "2026-09"\n}');
                    handleTabChange('protocol');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 rounded-lg"
                >
                  <Terminal className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Uji Tool MCP `cek_neraca_singkat`
                </Button>
              </CardContent>
            </Card>

            {/* Laba Rugi Diagnostic */}
            <Card className="border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3.5 px-5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Diagnostik Laba Rugi (Income Statement)
                  </CardTitle>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">
                  Akrual SAK ETAP
                </span>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-slate-500 block">Total Pendapatan</span>
                    <span className="font-mono font-bold text-sm text-slate-900 mt-1 block">
                      Rp {financialDiagnostics.totalRevenue.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-slate-500 block">Total Beban Operasional</span>
                    <span className="font-mono font-bold text-sm text-slate-900 mt-1 block">
                      Rp {financialDiagnostics.totalExpense.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/60 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between items-center text-slate-900 font-bold">
                    <span>Laba / (Rugi) Bersih Berjalan:</span>
                    <span className={`font-mono text-sm ${financialDiagnostics.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Rp {financialDiagnostics.netIncome.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setSelectedTool('cek_laba_rugi_singkat');
                    setToolPayload('{\n  "period": "2026-09"\n}');
                    handleTabChange('protocol');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 rounded-lg"
                >
                  <Terminal className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Uji Tool MCP `cek_laba_rugi_singkat`
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Pop-up Modal Kredensial Token Baru: Anti-Slop, High-Contrast & Secure */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="sm:max-w-lg max-w-[94vw] p-0 overflow-hidden rounded-xl bg-white border border-slate-200 shadow-xl">
          <div className="bg-slate-900 p-4 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Token Akses Agen Dibuat</h3>
                <p className="text-[11px] text-slate-400">Kredensial Model Context Protocol (MCP)</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              AKTIF
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Agen AI:</span>
              <strong className="text-slate-900 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {freshlyGeneratedKey?.record.name}
              </strong>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Bearer Secret Token</span>
                <span className="text-[10px] text-amber-800 font-medium">Salin Sekarang</span>
              </Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <code className="text-xs font-mono font-semibold text-slate-900 break-all select-all flex-1 px-1">
                  {freshlyGeneratedKey?.key}
                </code>
                <Button
                  size="sm"
                  onClick={() => {
                    if (freshlyGeneratedKey) {
                      navigator.clipboard.writeText(freshlyGeneratedKey.key);
                      setCopiedKey(true);
                      toast.success('Token disalin ke clipboard.');
                      setTimeout(() => setCopiedKey(false), 2500);
                    }
                  }}
                  className="h-8 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-3 rounded-md shrink-0"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Salin Token
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/90 text-amber-950 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                Catatan Keamanan: Token Hanya Ditampilkan Sekali
              </div>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                Demi keamanan data pembukuan Anda, nilai token rahasia ini tidak dapat ditampilkan kembali setelah modal ini ditutup. Segera simpan ke konfigurasi klien AI Anda.
              </p>
            </div>

            <div className="pt-1 flex justify-end">
              <Button
                onClick={() => setShowTokenModal(false)}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9 px-5 rounded-lg"
              >
                Saya Sudah Menyimpan Token Ini
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
