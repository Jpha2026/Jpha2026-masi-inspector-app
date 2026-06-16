import { useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { API_URL } from "../constants/api";

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

export async function queueRequest(
  url: string,
  method: "POST" | "PATCH",
  data: unknown,
  type = "generic"
): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  let queue: QueuedRequest[] = [];
  if (raw) { try { queue = JSON.parse(raw); } catch { queue = []; } }
  queue.push({
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url, method, data, type,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Backward-compatible wrapper
export async function queueInspection(payload: object): Promise<void> {
  await queueRequest(`${API_URL}/inspections`, "POST", payload, "inspection");
}

export async function getPendingCount(): Promise<number> {
  const [legRaw, raw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_KEY),
    AsyncStorage.getItem(QUEUE_KEY),
  ]);
  let legacy = 0, current = 0;
  try { legacy = legRaw ? (JSON.parse(legRaw) as unknown[]).length : 0; } catch {}
  try { current = raw ? (JSON.parse(raw) as unknown[]).length : 0; } catch {}
  return legacy + current;
}

async function syncAll(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  const remaining: QueuedRequest[] = [];

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
        await axios.post(`${API_URL}/inspections`, item.payload, { timeout: 12000 });
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
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify(legRemaining));
  }

  // Process generic queue
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (raw) {
    let queue: QueuedRequest[] = [];
    try { queue = JSON.parse(raw); } catch { queue = []; }
    let authFailed = false;
    for (const req of queue) {
      if (authFailed) { remaining.push(req); continue; }
      try {
        if (req.method === "POST") {
          await axios.post(req.url, req.data, { timeout: 12000 });
        } else {
          await axios.patch(req.url, req.data, { timeout: 12000 });
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
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }

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
