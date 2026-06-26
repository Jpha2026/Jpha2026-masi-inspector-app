import { useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { API_URL } from "../constants/api";

const TOKEN_KEY = "masi_token";

// Legacy type kept for backward compat
export type PendingInspection = {
  id: string;
  payload: object;
  timestamp: number;
};

export type QueuedRequest = {
  id: string;
  url: string;
  method: "POST" | "PATCH";
  data: unknown;
  type: string;
  timestamp: number;
};

const LEGACY_KEY = "offline_inspection_queue";
const QUEUE_KEY  = "masi_offline_queue_v2";
const ENC_KEY_STORE = "masi_queue_enc_key";
const AES_PREFIX = "v2:"; // prefix distinguishes AES-GCM from old XOR data

// ── AES-256-GCM helpers (Web Crypto API — available in Hermes/RN 0.73+) ──

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function bytesToHex(buf: Uint8Array | ArrayBuffer): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", hexToBytes(keyHex), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function aesEncrypt(plaintext: string, keyHex: string): Promise<string> {
  const iv = ExpoCrypto.getRandomBytes(12);
  const key = await importKey(keyHex);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(12 + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), 12);
  return AES_PREFIX + bytesToHex(out);
}

async function aesDecrypt(hex: string, keyHex: string): Promise<string> {
  const buf = hexToBytes(hex);
  const iv = buf.slice(0, 12);
  const data = buf.slice(12);
  const key = await importKey(keyHex);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

// Legacy XOR — only used during migration read of old data
function xorDecipher(hex: string, key: string): string {
  let out = "";
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16) ^ key.charCodeAt((i / 4) % key.length);
    out += String.fromCharCode(code);
  }
  return out;
}

async function getEncKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENC_KEY_STORE);
  if (!key) {
    const bytes = ExpoCrypto.getRandomBytes(32);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(ENC_KEY_STORE, key);
  }
  return key;
}

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const key = await getEncKey();
    // Unencrypted JSON (oldest format) → migrate to AES-GCM
    if (raw.startsWith("[")) {
      const queue = JSON.parse(raw) as QueuedRequest[];
      await AsyncStorage.setItem(QUEUE_KEY, await aesEncrypt(raw, key));
      return queue;
    }
    // AES-GCM (current format)
    if (raw.startsWith(AES_PREFIX)) {
      return JSON.parse(await aesDecrypt(raw.slice(AES_PREFIX.length), key));
    }
    // XOR (legacy format) → migrate to AES-GCM
    const json = xorDecipher(raw, key);
    const queue = JSON.parse(json) as QueuedRequest[];
    await AsyncStorage.setItem(QUEUE_KEY, await aesEncrypt(json, key));
    return queue;
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRequest[]): Promise<void> {
  try {
    const key = await getEncKey();
    await AsyncStorage.setItem(QUEUE_KEY, await aesEncrypt(JSON.stringify(queue), key));
  } catch {
    // Si SecureStore no está disponible, no guardar — evitar clave hardcodeada
  }
}

export async function queueRequest(
  url: string,
  method: "POST" | "PATCH",
  data: unknown,
  type = "generic"
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url, method, data, type,
    timestamp: Date.now(),
  });
  await writeQueue(queue);
}

// Backward-compatible wrapper
export async function queueInspection(payload: object): Promise<void> {
  await queueRequest(`${API_URL}/inspections`, "POST", payload, "inspection");
}

export async function getPendingCount(): Promise<number> {
  const [legRaw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_KEY),
  ]);
  let legacy = 0;
  try { legacy = legRaw ? (JSON.parse(legRaw) as unknown[]).length : 0; } catch {}
  const current = (await readQueue()).length;
  return legacy + current;
}

async function syncAll(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  const remaining: QueuedRequest[] = [];

  // Read auth token explicitly to avoid race with global axios header
  const authToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  // Process legacy inspection queue
  const legRaw = await AsyncStorage.getItem(LEGACY_KEY);
  let legFailed = 0;
  if (legRaw) {
    let legQueue: PendingInspection[] = [];
    try { legQueue = JSON.parse(legRaw); } catch { legQueue = []; }
    const legRemaining: PendingInspection[] = [];
    let legAuthFailed = false;
    for (const item of legQueue) {
      if (legAuthFailed) { legRemaining.push(item); continue; }
      try {
        await axios.post(`${API_URL}/inspections`, item.payload, { timeout: 12000, headers: authHeader });
        synced++;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          legAuthFailed = true;
          legRemaining.push(item);
        } else if (axios.isAxiosError(e) && e.response && e.response.status >= 400 && e.response.status < 500) {
          // 4xx permanente — descartar
        } else {
          legRemaining.push(item);
        }
      }
    }
    legFailed = legRemaining.length;
    if (legRemaining.length === 0) {
      await AsyncStorage.removeItem(LEGACY_KEY);
    } else {
      // Migrate failed items to encrypted queue instead of re-writing legacy plaintext
      for (const item of legRemaining) {
        await queueRequest(`${API_URL}/inspections`, "POST", item.payload, "inspection");
      }
      await AsyncStorage.removeItem(LEGACY_KEY);
      legFailed = 0; // items are now in encrypted queue, will retry next sync
    }
  }

  // Process generic queue
  const queue = await readQueue();
  let authFailed = false;
  for (const req of queue) {
    if (authFailed) { remaining.push(req); continue; }
    try {
      if (req.method === "POST") {
        await axios.post(req.url, req.data, { timeout: 12000, headers: authHeader });
      } else {
        await axios.patch(req.url, req.data, { timeout: 12000, headers: authHeader });
      }
      synced++;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        authFailed = true;
        remaining.push(req);
      } else if (axios.isAxiosError(e) && e.response && e.response.status >= 400 && e.response.status < 500) {
        // 4xx permanente (payload inválido) — descartar para no bloquear la cola
      } else {
        remaining.push(req);
      }
    }
  }
  await writeQueue(remaining);

  return { synced, failed: remaining.length + legFailed };
}

export function useOfflineSync(onSynced?: (count: number) => void) {
  const syncingRef = useRef(false);

  const attemptSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const { synced } = await syncAll();
      if (synced > 0) onSynced?.(synced);
    } finally {
      syncingRef.current = false;
    }
  }, [onSynced]);

  useEffect(() => {
    attemptSync();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) attemptSync();
    });
    return unsubscribe;
  }, [attemptSync]);

  return { attemptSync };
}
