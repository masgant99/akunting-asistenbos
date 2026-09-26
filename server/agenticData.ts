import fs from 'fs';
import path from 'path';

export interface AgentJournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  status: 'Draft' | 'Posted';
  entries: {
    coaId?: string;
    coaCode: string;
    coaName: string;
    debit: number;
    credit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  userId: string;
  source: 'agentic_mcp' | 'manual';
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'mcp-accounting-state.json');

interface UserAccountingState {
  coas: any[];
  journals: AgentJournalEntry[];
  lastSyncedAt: string;
}

function ensureStateFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readState(): Record<string, UserAccountingState> {
  try {
    ensureStateFile();
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writeState(state: Record<string, UserAccountingState>) {
  try {
    ensureStateFile();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write accounting state:', err);
  }
}

// Default standard COA if user hasn't synced custom accounts yet
const DEFAULT_COAS = [
  { id: 'coa-101', code: '101', name: 'Kas Utama (Cash)', category: 'Asset', normalBalance: 'Debit' },
  { id: 'coa-102', code: '102', name: 'Bank BCA Operasional', category: 'Asset', normalBalance: 'Debit' },
  { id: 'coa-103', code: '103', name: 'Piutang Usaha', category: 'Asset', normalBalance: 'Debit' },
  { id: 'coa-104', code: '104', name: 'Perlengkapan Kantor', category: 'Asset', normalBalance: 'Debit' },
  { id: 'coa-105', code: '105', name: 'Peralatan & Aset Tetap', category: 'Asset', normalBalance: 'Debit' },
  { id: 'coa-201', code: '201', name: 'Utang Usaha (Accounts Payable)', category: 'Liability', normalBalance: 'Credit' },
  { id: 'coa-202', code: '202', name: 'Utang Gaji', category: 'Liability', normalBalance: 'Credit' },
  { id: 'coa-301', code: '301', name: 'Modal Pemilik (Owner Equity)', category: 'Equity', normalBalance: 'Credit' },
  { id: 'coa-401', code: '401', name: 'Pendapatan Jasa / Usaha', category: 'Revenue', normalBalance: 'Credit' },
  { id: 'coa-501', code: '501', name: 'Beban Gaji & Upah', category: 'Expense', normalBalance: 'Debit' },
  { id: 'coa-502', code: '502', name: 'Beban Sewa Kantor', category: 'Expense', normalBalance: 'Debit' },
  { id: 'coa-503', code: '503', name: 'Beban Listrik, Air & Internet', category: 'Expense', normalBalance: 'Debit' },
  { id: 'coa-504', code: '504', name: 'Beban Pemasaran & Iklan', category: 'Expense', normalBalance: 'Debit' },
  { id: 'coa-505', code: '505', name: 'Beban Perlengkapan Operasional', category: 'Expense', normalBalance: 'Debit' }
];

export function syncUserData(userId: string, coas: any[] = [], journals: any[] = []) {
  if (!userId) return;
  const state = readState();
  const existing = state[userId] || { coas: [], journals: [], lastSyncedAt: '' };

  // Merge journals without duplicate IDs
  const journalMap = new Map<string, any>();
  existing.journals.forEach((j: any) => journalMap.set(j.id, j));
  journals.forEach((j: any) => journalMap.set(j.id, j));

  state[userId] = {
    coas: coas && coas.length > 0 ? coas : (existing.coas.length > 0 ? existing.coas : DEFAULT_COAS),
    journals: Array.from(journalMap.values()),
    lastSyncedAt: new Date().toISOString()
  };

  writeState(state);
}

export function getUserCOAs(userId: string) {
  const state = readState();
  if (state[userId] && state[userId].coas && state[userId].coas.length > 0) {
    return state[userId].coas;
  }
  return DEFAULT_COAS;
}

export function getUserJournals(userId: string): AgentJournalEntry[] {
  const state = readState();
  return (state[userId]?.journals || []) as AgentJournalEntry[];
}

export function postJournalByAgent(userId: string, payload: {
  description: string;
  date?: string;
  reference?: string;
  entries: { coaCodeOrName: string; debit?: number; credit?: number }[];
}): { success: boolean; journal?: AgentJournalEntry; error?: string } {
  const coas = getUserCOAs(userId);
  const entriesRaw = payload.entries || [];

  if (entriesRaw.length < 2) {
    return { success: false, error: 'Jurnal berpasangan minimal harus memiliki 2 entri (Debit dan Kredit).' };
  }

  const processedEntries = entriesRaw.map(e => {
    const term = (e.coaCodeOrName || '').toString().trim().toLowerCase();
    const found = coas.find((a: any) => 
      a.code.toString() === term || 
      a.name.toLowerCase() === term ||
      a.name.toLowerCase().includes(term) ||
      term.includes(a.name.toLowerCase())
    ) || coas[0];

    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;

    return {
      coaId: found.id || '',
      coaCode: found.code,
      coaName: found.name,
      debit,
      credit
    };
  });

  const totalDebit = processedEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = processedEntries.reduce((s, e) => s + e.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
    return {
      success: false,
      error: `Jurnal tidak seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) != Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}).`
    };
  }

  const newJournal: AgentJournalEntry = {
    id: `jrn_agent_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    date: payload.date || new Date().toISOString().split('T')[0],
    description: payload.description || 'Transaksi via MCP Agentic Copilot',
    reference: payload.reference || `MCP-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'Posted',
    entries: processedEntries,
    totalDebit,
    totalCredit,
    userId,
    source: 'agentic_mcp',
    createdAt: new Date().toISOString()
  };

  const state = readState();
  if (!state[userId]) {
    state[userId] = { coas, journals: [], lastSyncedAt: new Date().toISOString() };
  }
  state[userId].journals.unshift(newJournal);
  writeState(state);

  return { success: true, journal: newJournal };
}

export function calculateNeracaSingkat(userId: string) {
  const coas = getUserCOAs(userId);
  const journals = getUserJournals(userId);

  const getBalance = (coaId: string, category: string) => {
    const entries = journals.flatMap(j => j.entries || []).filter((e: any) => e.coaId === coaId);
    const deb = entries.reduce((s, e: any) => s + (Number(e.debit) || 0), 0);
    const crd = entries.reduce((s, e: any) => s + (Number(e.credit) || 0), 0);
    if (category === 'Asset' || category === 'Expense') {
      return deb - crd;
    }
    return crd - deb;
  };

  const getCategoryTotal = (cat: string) => {
    return coas
      .filter((a: any) => a.category === cat)
      .reduce((sum: number, a: any) => sum + getBalance(a.id, cat), 0);
  };

  const totalAsset = getCategoryTotal('Asset');
  const totalLiability = getCategoryTotal('Liability');
  const totalEquity = getCategoryTotal('Equity');
  const totalRevenue = getCategoryTotal('Revenue');
  const totalExpense = getCategoryTotal('Expense');
  const netIncome = totalRevenue - totalExpense;

  const totalPasiva = totalLiability + totalEquity + netIncome;
  const isBalanced = Math.abs(totalAsset - totalPasiva) < 1;

  return {
    asOfDate: new Date().toISOString().split('T')[0],
    aktiva: {
      totalAset: totalAsset,
      formatRupiah: `Rp ${totalAsset.toLocaleString('id-ID')}`
    },
    pasiva: {
      totalLiabilitas: totalLiability,
      totalEkuitas: totalEquity,
      labaBerjalan: netIncome,
      totalPasiva: totalPasiva,
      formatRupiah: `Rp ${totalPasiva.toLocaleString('id-ID')}`
    },
    audit: {
      isBalanced,
      status: isBalanced ? 'SEIMBANG (MATCH)' : 'TIDAK SEIMBANG (SELISIH)',
      selisih: Math.abs(totalAsset - totalPasiva)
    },
    ringkasanText: `Neraca per ${new Date().toLocaleDateString('id-ID')}: Total Aktiva Rp ${totalAsset.toLocaleString('id-ID')} | Total Pasiva Rp ${totalPasiva.toLocaleString('id-ID')} (${isBalanced ? 'Seimbang' : 'Selisih Rp ' + Math.abs(totalAsset - totalPasiva).toLocaleString('id-ID')})`
  };
}

export function calculateLabaRugiSingkat(userId: string) {
  const coas = getUserCOAs(userId);
  const journals = getUserJournals(userId);

  const getBalance = (coaId: string, category: string) => {
    const entries = journals.flatMap(j => j.entries || []).filter((e: any) => e.coaId === coaId);
    const deb = entries.reduce((s, e: any) => s + (Number(e.debit) || 0), 0);
    const crd = entries.reduce((s, e: any) => s + (Number(e.credit) || 0), 0);
    if (category === 'Asset' || category === 'Expense') {
      return deb - crd;
    }
    return crd - deb;
  };

  const getCategoryTotal = (cat: string) => {
    return coas
      .filter((a: any) => a.category === cat)
      .reduce((sum: number, a: any) => sum + getBalance(a.id, cat), 0);
  };

  const totalRevenue = getCategoryTotal('Revenue');
  const totalExpense = getCategoryTotal('Expense');
  const netIncome = totalRevenue - totalExpense;
  const marginPercent = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0';

  return {
    asOfDate: new Date().toISOString().split('T')[0],
    pendapatan: {
      total: totalRevenue,
      formatRupiah: `Rp ${totalRevenue.toLocaleString('id-ID')}`
    },
    beban: {
      total: totalExpense,
      formatRupiah: `Rp ${totalExpense.toLocaleString('id-ID')}`
    },
    labaBersih: {
      nominal: netIncome,
      status: netIncome >= 0 ? 'LABA BERSIH (PROFIT)' : 'RUGI BERSIH (LOSS)',
      formatRupiah: `Rp ${netIncome.toLocaleString('id-ID')}`,
      margin: `${marginPercent}%`
    },
    ringkasanText: `Laba Rugi: Pendapatan Rp ${totalRevenue.toLocaleString('id-ID')} - Beban Rp ${totalExpense.toLocaleString('id-ID')} = ${netIncome >= 0 ? 'Laba' : 'Rugi'} Rp ${netIncome.toLocaleString('id-ID')} (Margin: ${marginPercent}%)`
  };
}
