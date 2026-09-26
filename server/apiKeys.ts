import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ApiKeyRecord {
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

const DATA_DIR = path.join(process.cwd(), '.data');
const KEYS_FILE = path.join(DATA_DIR, 'mcp-api-keys.json');

// Ensure directory exists
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readKeys(): ApiKeyRecord[] {
  try {
    ensureStorage();
    const data = fs.readFileSync(KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read MCP API keys:', err);
    return [];
  }
}

function writeKeys(keys: ApiKeyRecord[]) {
  try {
    ensureStorage();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write MCP API keys:', err);
  }
}

/**
 * Generate a new secure API key with prefix lp_live_
 */
export function generateApiKey(userId: string, userEmail: string = '', name: string = 'Default Agent'): { key: string; record: ApiKeyRecord } {
  const keys = readKeys();
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const fullKey = `lp_live_${randomBytes}`;
  const prefix = `lp_live_${randomBytes.slice(0, 6)}...${randomBytes.slice(-4)}`;
  const id = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const record: ApiKeyRecord = {
    id,
    name: name.trim() || 'Agentic Assistant',
    key: fullKey,
    prefix,
    status: 'active',
    userId,
    userEmail,
    permissions: ['mcp:read', 'mcp:write', 'journals:post', 'reports:read'],
    createdAt: new Date().toISOString(),
  };

  keys.push(record);
  writeKeys(keys);

  return { key: fullKey, record };
}

/**
 * Validate an incoming API key/token
 */
export function validateApiKey(rawKey: string | undefined): ApiKeyRecord | null {
  if (!rawKey) return null;
  const cleanKey = rawKey.replace(/^Bearer\s+/i, '').trim();
  if (!cleanKey) return null;

  const keys = readKeys();
  const found = keys.find(k => k.key === cleanKey && k.status === 'active');
  if (found) {
    // Update lastUsedAt asynchronously
    found.lastUsedAt = new Date().toISOString();
    writeKeys(keys);
    return found;
  }
  return null;
}

/**
 * List all keys for a given user
 */
export function listApiKeys(userId: string): ApiKeyRecord[] {
  const keys = readKeys();
  return keys
    .filter(k => k.userId === userId)
    .map(k => ({
      ...k,
      // Mask full key for listing unless freshly generated
      key: `${k.prefix}`,
    }));
}

/**
 * Revoke or delete key
 */
export function revokeApiKey(id: string, userId: string): boolean {
  const keys = readKeys();
  const key = keys.find(k => k.id === id && k.userId === userId);
  if (key) {
    key.status = 'revoked';
    writeKeys(keys);
    return true;
  }
  return false;
}

export function deleteApiKey(id: string, userId: string): boolean {
  let keys = readKeys();
  const originalLength = keys.length;
  keys = keys.filter(k => !(k.id === id && k.userId === userId));
  if (keys.length !== originalLength) {
    writeKeys(keys);
    return true;
  }
  return false;
}

/**
 * Sync key from client or restore
 */
export function syncKeyRecord(record: ApiKeyRecord) {
  const keys = readKeys();
  const index = keys.findIndex(k => k.id === record.id || k.key === record.key);
  if (index >= 0) {
    keys[index] = { ...keys[index], ...record };
  } else {
    keys.push(record);
  }
  writeKeys(keys);
}
