/**
 * MCP (Model Context Protocol) & Agentic AI client helpers
 */

export type MCPTab = 'journal' | 'neraca' | 'labarugi' | 'protocol' | 'keys';

export const openMCPModal = (tab: MCPTab = 'journal') => {
  window.dispatchEvent(new CustomEvent('open-mcp-modal', { detail: { tab } }));
};

export interface MCPKeyItem {
  id: string;
  name: string;
  key: string;
  prefix: string;
  status: 'active' | 'revoked';
  userId: string;
  userEmail?: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export async function fetchApiKeys(userId: string): Promise<MCPKeyItem[]> {
  try {
    const res = await fetch(`/api/mcp/keys?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.keys || [];
  } catch (err) {
    console.error('Failed to fetch MCP API keys:', err);
    return [];
  }
}

export async function generateApiKeyApi(userId: string, userEmail: string, name: string): Promise<{ success: boolean; key?: string; record?: MCPKeyItem; error?: string }> {
  try {
    const res = await fetch('/api/mcp/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userEmail, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Gagal membuat API Key' };
    }
    return { success: true, key: data.key, record: data.record };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Koneksi gagal' };
  }
}

export async function deleteApiKeyApi(keyId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/mcp/keys/${encodeURIComponent(keyId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function syncUserDataToMCP(userId: string, coas: any[], journals: any[]): Promise<boolean> {
  try {
    const res = await fetch('/api/mcp/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, coas, journals }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function testMCPConnection(token: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal terhubung ke MCP server' };
  }
}
