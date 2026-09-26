import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { validateApiKey } from './apiKeys';
import { 
  postJournalByAgent, 
  calculateNeracaSingkat, 
  calculateLabaRugiSingkat, 
  getUserCOAs, 
  getUserJournals,
  syncUserData 
} from './agenticData';

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Definition of standard MCP Tools for Agentic AI
export const MCP_TOOLS = [
  {
    name: 'input_jurnal',
    description: 'Mencatat transaksi jurnal umum berpasangan (double-entry accounting) ke dalam sistem Lentera Akunting. Memvalidasi keseimbangan Debit dan Kredit serta langsung membukukan ke database akun.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { 
          type: 'string', 
          description: 'Keterangan transaksi (misal: Pembelian perlengkapan kantor tunai Rp 500.000)' 
        },
        date: { 
          type: 'string', 
          description: 'Tanggal transaksi format YYYY-MM-DD (default hari ini jika kosong)' 
        },
        reference: { 
          type: 'string', 
          description: 'Nomor referensi bukti atau invoice (opsional)' 
        },
        entries: {
          type: 'array',
          description: 'Rincian jurnal berpasangan debit dan kredit',
          items: {
            type: 'object',
            properties: {
              coaCodeOrName: { type: 'string', description: 'Kode akun (misal: "101", "502") atau nama akun COA (misal: "Kas", "Beban Sewa")' },
              debit: { type: 'number', description: 'Nominal debit (0 jika kredit)' },
              credit: { type: 'number', description: 'Nominal kredit (0 jika debit)' }
            },
            required: ['coaCodeOrName']
          }
        }
      },
      required: ['description', 'entries']
    }
  },
  {
    name: 'cek_neraca_singkat',
    description: 'Mengecek ringkasan posisi keuangan / neraca saldo singkat (Balance Sheet), memverifikasi keseimbangan Aktiva (Aset) vs Pasiva (Kewajiban + Ekuitas) secara real-time dari data perusahaan.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { 
          type: 'string', 
          description: 'Periode laporan (opsional, format YYYY-MM)' 
        }
      }
    }
  },
  {
    name: 'cek_laba_rugi_singkat',
    description: 'Mengecek ringkasan performa laba rugi singkat (Income Statement): Total Pendapatan, Total Beban, Laba Bersih / Rugi berjalan, serta persentase net margin.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { 
          type: 'string', 
          description: 'Periode laporan (opsional, format YYYY-MM)' 
        }
      }
    }
  },
  {
    name: 'get_coa_list',
    description: 'Mengambil daftar Master Chart of Accounts (COA) perusahaan beserta kode akun, nama akun, kategori (Asset, Liability, Equity, Revenue, Expense), dan saldo normal.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_recent_journals',
    description: 'Mengambil riwayat transaksi jurnal umum terkini yang telah dibukukan ke dalam pembukuan.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Jumlah jurnal yang ingin diambil (default 10)' }
      }
    }
  },
  {
    name: 'parse_transaksi_ai',
    description: 'Menganalisis teks bahasa alami transaksi (contoh: "Bayar sewa kantor 3.000.000 via transfer bank BCA") menjadi entri jurnal debit dan kredit otomatis sesuai bagan akun.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { 
          type: 'string', 
          description: 'Deskripsi transaksi natural language dalam bahasa Indonesia' 
        },
        availableAccounts: {
          type: 'array',
          description: 'Daftar akun COA yang tersedia (opsional)',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              category: { type: 'string' }
            }
          }
        }
      },
      required: ['prompt']
    }
  }
];

// Fallback Indonesian Natural Language Accounting Parser
export function parseTransactionHeuristic(
  text: string, 
  availableAccounts?: { id?: string; code: string; name: string; category: string }[]
) {
  const lower = text.toLowerCase();
  
  let amount = 0;
  const jtMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/);
  const rbMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k\b)/);
  const rawNumMatch = lower.match(/(?:rp\.?|idr)?\s*(\d{1,3}(?:\.\d{3})+|\d+)/);

  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    amount = val * 1_000_000;
  } else if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    amount = val * 1_000;
  } else if (rawNumMatch) {
    const cleanStr = rawNumMatch[1].replace(/\./g, '');
    amount = parseInt(cleanStr, 10);
  }

  if (!amount || isNaN(amount)) {
    amount = 500000;
  }

  const defaultAccounts = [
    { code: '101', name: 'Kas Utama (Cash)', category: 'Asset' },
    { code: '102', name: 'Bank BCA Operasional', category: 'Asset' },
    { code: '103', name: 'Piutang Usaha', category: 'Asset' },
    { code: '201', name: 'Utang Usaha', category: 'Liability' },
    { code: '301', name: 'Modal Pemilik', category: 'Equity' },
    { code: '401', name: 'Pendapatan Jasa', category: 'Revenue' },
    { code: '501', name: 'Beban Gaji', category: 'Expense' },
    { code: '502', name: 'Beban Sewa Kantor', category: 'Expense' },
    { code: '503', name: 'Beban Listrik, Air & Internet', category: 'Expense' },
    { code: '504', name: 'Beban Perlengkapan Operasional', category: 'Expense' },
  ];

  const accounts = availableAccounts && availableAccounts.length > 0 ? availableAccounts : defaultAccounts;

  const findAcc = (queryList: string[], fallbackCode: string) => {
    for (const q of queryList) {
      const match = accounts.find(a => a.name.toLowerCase().includes(q) || a.code === q);
      if (match) return match;
    }
    return accounts.find(a => a.code === fallbackCode) || accounts[0];
  };

  const isBank = lower.includes('bank') || lower.includes('bca') || lower.includes('mandiri') || lower.includes('transfer') || lower.includes('qris');
  const paymentAcc = isBank ? findAcc(['bank', 'bca'], '102') : findAcc(['kas', 'tunai', 'cash'], '101');

  if (lower.includes('terima') || lower.includes('pendapatan') || lower.includes('omset') || lower.includes('jual') || lower.includes('pemasukan') || lower.includes('penjualan')) {
    const revAcc = findAcc(['pendapatan', 'jasa', 'penjualan'], '401');
    return {
      description: text,
      date: new Date().toISOString().split('T')[0],
      reference: `MCP-${Math.floor(1000 + Math.random() * 9000)}`,
      totalDebit: amount,
      totalCredit: amount,
      entries: [
        {
          coaId: (paymentAcc as any).id || '',
          coaCode: paymentAcc.code,
          coaName: paymentAcc.name,
          debit: amount,
          credit: 0,
        },
        {
          coaId: (revAcc as any).id || '',
          coaCode: revAcc.code,
          coaName: revAcc.name,
          debit: 0,
          credit: amount,
        }
      ],
      confidence: 'heuristic',
    };
  }

  let expenseAcc = findAcc(['perlengkapan', 'operasional', 'biaya'], '504');
  if (lower.includes('sewa')) {
    expenseAcc = findAcc(['sewa'], '502');
  } else if (lower.includes('gaji') || lower.includes('upah')) {
    expenseAcc = findAcc(['gaji'], '501');
  } else if (lower.includes('listrik') || lower.includes('air') || lower.includes('internet') || lower.includes('wifi') || lower.includes('pln')) {
    expenseAcc = findAcc(['listrik', 'utilitas'], '503');
  }

  const entries = [
    {
      coaId: (expenseAcc as any).id || '',
      coaCode: expenseAcc.code,
      coaName: expenseAcc.name,
      debit: amount,
      credit: 0,
    },
    {
      coaId: (paymentAcc as any).id || '',
      coaCode: paymentAcc.code,
      coaName: paymentAcc.name,
      debit: 0,
      credit: amount,
    }
  ];

  return {
    description: text,
    date: new Date().toISOString().split('T')[0],
    reference: `MCP-${Math.floor(1000 + Math.random() * 9000)}`,
    totalDebit: amount,
    totalCredit: amount,
    entries,
    confidence: 'heuristic',
  };
}

// AI Parser using Gemini 3.8 Flash
export async function parseTransactionWithGemini(
  prompt: string, 
  availableAccounts?: { id?: string; code: string; name: string; category: string }[]
) {
  const ai = getAIClient();
  if (!ai) {
    return parseTransactionHeuristic(prompt, availableAccounts);
  }

  try {
    const coaListStr = availableAccounts && availableAccounts.length > 0
      ? availableAccounts.map(a => `[${a.code}] ${a.name} (${a.category})`).join(', ')
      : '101 Kas, 102 Bank, 103 Piutang, 201 Utang Usaha, 301 Modal, 401 Pendapatan Usaha, 501 Beban Gaji, 502 Beban Sewa, 503 Beban Listrik, 504 Beban Perlengkapan';

    const systemPrompt = `Kamu adalah Model Context Protocol (MCP) Accounting Engine untuk sistem Lentera Akunting berstandar SAK-ETAP/PSAK Indonesia.
Tugasmu adalah menganalisis teks transaksi bahasa alami menjadi jurnal berpasangan (double-entry journal) dengan prinsip:
1. DEBIT HARUS SAMA DENGAN KREDIT.
2. Gunakan akun yang paling sesuai dari daftar Chart of Accounts (COA) berikut:
${coaListStr}
3. Format output HARUS JSON valid tanpa markdown backticks tambahan.
Schema JSON:
{
  "description": "Deskripsi formal transaksi akuntansi",
  "date": "YYYY-MM-DD",
  "reference": "REF-XXXX",
  "entries": [
    {
      "coaCode": "kode akun COA",
      "coaName": "nama akun COA",
      "debit": number,
      "credit": number
    }
  ],
  "reasoning": "Penjelasan singkat penjurnalan akuntansi"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nAnalisis transaksi ini: "${prompt}"` }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || '';
    const cleanJson = text.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.entries && Array.isArray(parsed.entries) && availableAccounts) {
      parsed.entries = parsed.entries.map((entry: any) => {
        const found = availableAccounts.find(
          a => a.code === entry.coaCode || a.name.toLowerCase() === (entry.coaName || '').toLowerCase()
        ) || availableAccounts.find(
          a => a.name.toLowerCase().includes((entry.coaName || '').toLowerCase())
        );
        return {
          ...entry,
          coaId: found?.id || '',
          coaCode: found?.code || entry.coaCode,
          coaName: found?.name || entry.coaName,
        };
      });
    }

    const totalDebit = (parsed.entries || []).reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0);
    const totalCredit = (parsed.entries || []).reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0);

    return {
      description: parsed.description || prompt,
      date: parsed.date || new Date().toISOString().split('T')[0],
      reference: parsed.reference || `MCP-${Math.floor(1000 + Math.random() * 9000)}`,
      entries: parsed.entries || [],
      totalDebit,
      totalCredit,
      reasoning: parsed.reasoning || 'Dianalisis menggunakan Gemini 3.8 Flash',
      confidence: 'ai',
    };
  } catch (error) {
    console.warn('Gemini MCP Parse fallback to heuristic:', error);
    return parseTransactionHeuristic(prompt, availableAccounts);
  }
}

/**
 * Handle JSON-RPC 2.0 MCP Protocol requests with Agentic Authentication
 */
export async function handleMCPJsonRpc(req: Request, res: Response) {
  const body = req.body || {};
  const { jsonrpc, id, method, params } = body;

  // Extract auth token
  const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string) || (req.query.token as string) || (req.query.apiKey as string);
  
  let authenticatedUser: { userId: string; userEmail?: string; keyRecord?: any } | null = null;
  
  if (authHeader) {
    const verified = validateApiKey(authHeader);
    if (!verified) {
      return res.status(401).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid or revoked MCP API Key. Please provide a valid Bearer token (lp_live_...) or x-api-key.',
        },
      });
    }
    authenticatedUser = { userId: verified.userId, userEmail: verified.userEmail, keyRecord: verified };
  } else {
    // If internal request from browser preview without token
    const clientUserId = (req.headers['x-user-id'] as string) || 'default-user';
    authenticatedUser = { userId: clientUserId };
  }

  const userId = authenticatedUser.userId;

  // If not JSON-RPC method request, return MCP manifest info
  if (jsonrpc !== '2.0' && !method) {
    return res.json({
      name: 'lentera-accounting-mcp',
      version: '1.1.0',
      description: 'Model Context Protocol Server for Lentera Akunting (Jurnal Umum, Neraca, Laba Rugi, COA)',
      protocolVersion: '2024-11-05',
      authenticated: !!authHeader,
      tools: MCP_TOOLS,
    });
  }

  const responseId = id ?? null;

  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false },
            },
            serverInfo: {
              name: 'lentera-accounting-mcp',
              version: '1.1.0',
            },
            authenticatedAs: authenticatedUser.userEmail || authenticatedUser.userId,
          },
        });

      case 'notifications/initialized':
      case 'ping':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: { status: 'healthy', timestamp: new Date().toISOString() },
        });

      case 'tools/list':
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          result: {
            tools: MCP_TOOLS,
          },
        });

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName === 'get_coa_list') {
          const coas = getUserCOAs(userId);
          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ totalAccounts: coas.length, accounts: coas }, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === 'get_recent_journals') {
          const limit = Number(toolArgs.limit) || 10;
          const journals = getUserJournals(userId).slice(0, limit);
          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ count: journals.length, journals }, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === 'parse_transaksi_ai') {
          const coas = getUserCOAs(userId);
          const result = await parseTransactionWithGemini(toolArgs.prompt || '', toolArgs.availableAccounts || coas);
          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === 'input_jurnal') {
          const postResult = postJournalByAgent(userId, {
            description: toolArgs.description,
            date: toolArgs.date,
            reference: toolArgs.reference,
            entries: toolArgs.entries || [],
          });

          if (!postResult.success) {
            return res.json({
              jsonrpc: '2.0',
              id: responseId,
              error: {
                code: -32602,
                message: postResult.error || 'Gagal memvalidasi atau memposting jurnal akuntansi.',
              },
            });
          }

          const responsePayload = {
            status: 'success_posted',
            message: 'Jurnal berhasil diverifikasi dan dibukukan ke dalam sistem pembukuan Lentera Akunting.',
            journal: postResult.journal,
          };

          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(responsePayload, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === 'cek_neraca_singkat') {
          const summary = calculateNeracaSingkat(userId);
          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(summary, null, 2),
                },
              ],
            },
          });
        }

        if (toolName === 'cek_laba_rugi_singkat') {
          const summary = calculateLabaRugiSingkat(userId);
          return res.json({
            jsonrpc: '2.0',
            id: responseId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(summary, null, 2),
                },
              ],
            },
          });
        }

        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          error: {
            code: -32601,
            message: `Tool '${toolName}' tidak ditemukan. Silakan panggil 'tools/list' untuk melihat daftar tools yang tersedia.`,
          },
        });
      }

      default:
        return res.json({
          jsonrpc: '2.0',
          id: responseId,
          error: {
            code: -32601,
            message: `Method '${method}' tidak didukung oleh MCP Server ini.`,
          },
        });
    }
  } catch (err: any) {
    console.error('MCP JSON-RPC Error:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      id: responseId,
      error: {
        code: -32603,
        message: err?.message || 'Internal MCP server error',
      },
    });
  }
}
