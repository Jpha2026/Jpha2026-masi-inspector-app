import { useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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

// XOR-cipher: converts text ↔ hex string using the stored SecureStore key.
// The hex encoding avoids any issues with binary characters in AsyncStorage.
function xorCipher(text: string, key: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    out += code.toString(16).padStart(4, "0");
  }
  return out;
}

function xorDecipher(hex: string, key: string): string {
  let out = "";
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16) ^ key.charCodeAt((i / 4) % key.length);
    out += String.fromCharCode(code);
  }
  return out;
}

async function getEncKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(ENC_KEY_STORE);
    if (!key) {
      // Generate 32-byte random key as hex string
      key = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
      ).join("");
      await SecureStore.setItemAsync(ENC_KEY_STORE, key);
    }
    return key;
  } catch {
    return "masi_fallback_enc_key_v1";
  }
}

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    // Detect legacy unencrypted JSON (starts with '[')
    if (raw.startsWith("[")) {
      // Migrate: re-save encrypted
      const key = await getEncKey();
      await AsyncStorage.setItem(QUEUE_KEY, xorCipher(raw, key));
      try { return JSON.parse(raw); } catch { return []; }
    }
    const key = await getEncKey();
    return JSON.parse(xorDecipher(raw, key));
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedRequest[]): Promise<void> {
  const key = await getEncKey();
  await AsyncStorage.setItem(QUEUE_KEY, xorCipher(JSON.stringify(queue), key));
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
      await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(legRemaining));
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
