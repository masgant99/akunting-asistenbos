import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { handleMCPJsonRpc, MCP_TOOLS, parseTransactionWithGemini } from "./server/mcp";
import { 
  generateApiKey, 
  listApiKeys, 
  deleteApiKey, 
  revokeApiKey, 
  syncKeyRecord 
} from "./server/apiKeys";
import { syncUserData, getUserJournals } from "./server/agenticData";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // MCP Protocol Endpoints
  // Standard Model Context Protocol (JSON-RPC 2.0 & Info)
  app.all("/api/mcp", handleMCPJsonRpc);

  // MCP Tools manifest list
  app.get("/api/mcp/tools", (req, res) => {
    res.json({
      protocolVersion: "2024-11-05",
      serverInfo: { name: "lentera-accounting-mcp", version: "1.1.0" },
      tools: MCP_TOOLS,
    });
  });

  // MCP API Key Management Endpoints (for Agentic AI connections)
  app.post("/api/mcp/keys", (req, res) => {
    try {
      const { userId, userEmail, name } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Parameter 'userId' wajib disertakan." });
      }
      const result = generateApiKey(userId, userEmail || "", name || "Agentic Assistant");
      res.json({ success: true, key: result.key, record: result.record });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal membuat API Key" });
    }
  });

  app.get("/api/mcp/keys", (req, res) => {
    try {
      const userId = (req.query.userId as string) || (req.headers["x-user-id"] as string);
      if (!userId) {
        return res.status(400).json({ error: "Parameter 'userId' wajib disertakan." });
      }
      const keys = listApiKeys(userId);
      res.json({ success: true, keys });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal mengambil daftar API Key" });
    }
  });

  app.delete("/api/mcp/keys/:id", (req, res) => {
    try {
      const userId = (req.query.userId as string) || (req.headers["x-user-id"] as string) || req.body?.userId;
      const keyId = req.params.id;
      if (!userId) {
        return res.status(400).json({ error: "Parameter 'userId' wajib disertakan." });
      }
      const success = deleteApiKey(keyId, userId);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal menghapus API Key" });
    }
  });

  app.post("/api/mcp/keys/sync", (req, res) => {
    try {
      const { record } = req.body;
      if (record) {
        syncKeyRecord(record);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal sinkronisasi API Key" });
    }
  });

  // Sync user accounting data (COA & journals) for live Agent access
  app.post("/api/mcp/sync-data", (req, res) => {
    try {
      const { userId, coas = [], journals = [] } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Parameter 'userId' wajib disertakan." });
      }
      syncUserData(userId, coas, journals);
      res.json({ success: true, coasCount: coas.length, journalsCount: journals.length });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal sinkronisasi data akuntansi" });
    }
  });

  // Get journals posted by agentic connections
  app.get("/api/mcp/agent/journals", (req, res) => {
    try {
      const userId = (req.query.userId as string) || (req.headers["x-user-id"] as string);
      if (!userId) {
        return res.status(400).json({ error: "Parameter 'userId' wajib disertakan." });
      }
      const journals = getUserJournals(userId);
      res.json({ success: true, journals });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal mengambil data jurnal agent" });
    }
  });

  // MCP AI transaction parser
  app.post("/api/mcp/parse", async (req, res) => {
    try {
      const { prompt, availableAccounts } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Parameter 'prompt' wajib diisi." });
      }
      const result = await parseTransactionWithGemini(prompt, availableAccounts);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal memproses transaksi MCP" });
    }
  });

  // MCP Concise Financial Summary (Neraca & Laba Rugi Singkat)
  app.post("/api/mcp/summary", (req, res) => {
    try {
      const { coas = [], journals = [] } = req.body;
      
      // Calculate balances
      const getBalance = (coaId: string, category: string) => {
        const entries = journals.flatMap((j: any) => j.entries || []).filter((e: any) => e.coaId === coaId);
        const deb = entries.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0);
        const crd = entries.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0);
        if (category === 'Asset' || category === 'Expense') {
          return deb - crd;
        }
        return crd - deb;
      };

      const accountBalances = coas.map((c: any) => ({
        ...c,
        balance: getBalance(c.id, c.category)
      }));

      const sumCategory = (cat: string) => {
        return accountBalances
          .filter((c: any) => c.category === cat && !c.parentId)
          .reduce((sum: number, c: any) => sum + c.balance, 0);
      };

      const totalAsset = sumCategory('Asset');
      const totalLiability = sumCategory('Liability');
      const totalEquity = sumCategory('Equity');
      const totalRevenue = sumCategory('Revenue');
      const totalExpense = sumCategory('Expense');
      const netIncome = totalRevenue - totalExpense;
      const totalPasiva = totalLiability + totalEquity + netIncome;
      const isBalanced = Math.abs(totalAsset - totalPasiva) < 1;

      // Group cash & bank
      const cashBankTotal = accountBalances
        .filter((c: any) => c.category === 'Asset' && (c.code.startsWith('10') || c.name.toLowerCase().includes('kas') || c.name.toLowerCase().includes('bank')))
        .reduce((sum: number, c: any) => sum + c.balance, 0);

      // Group receivables
      const piutangTotal = accountBalances
        .filter((c: any) => c.category === 'Asset' && (c.code.startsWith('11') || c.name.toLowerCase().includes('piutang')))
        .reduce((sum: number, c: any) => sum + c.balance, 0);

      // Group payables
      const utangTotal = accountBalances
        .filter((c: any) => c.category === 'Liability' && (c.code.startsWith('20') || c.name.toLowerCase().includes('utang') || c.name.toLowerCase().includes('hutang')))
        .reduce((sum: number, c: any) => sum + c.balance, 0);

      res.json({
        timestamp: new Date().toISOString(),
        neraca: {
          totalAsset,
          totalLiability,
          totalEquity,
          netIncome,
          totalPasiva,
          isBalanced,
          difference: totalAsset - totalPasiva,
          breakdown: {
            cashAndBank: cashBankTotal,
            receivables: piutangTotal,
            payables: utangTotal,
            equityCapital: totalEquity
          }
        },
        labaRugi: {
          totalRevenue,
          totalExpense,
          netIncome,
          isProfit: netIncome >= 0,
          profitMarginPct: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0.0',
          topExpenses: accountBalances
            .filter((c: any) => c.category === 'Expense')
            .sort((a: any, b: any) => b.balance - a.balance)
            .slice(0, 3)
            .map((e: any) => ({ code: e.code, name: e.name, amount: e.balance }))
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Gagal menghitung ringkasan laporan" });
    }
  });

  // Example API route for potentially heavy report generation or Gemini tasks
  app.post("/api/reports/export", (req, res) => {
    res.json({ message: "Ready for export processing" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
