import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import axios from "axios";
import { queueRequest } from "./useOfflineSync";
import { API_URL } from "../constants/api";
import type { GeoPoint } from "./useLocation";

// Send immediately; fall back to offline queue only if network fails
async function sendNow(url: string, method: "POST" | "PATCH", data: unknown, type: string) {
  try {
    if (method === "POST") await axios.post(url, data, { timeout: 8000 });
    else await axios.patch(url, data, { timeout: 8000 });
  } catch {
    await queueRequest(url, method, data, type);
  }
}

const JORNADA_KEY = "masi_active_jornada";

export type ActiveJornada = {
  id: string;
  inspector_id: string;
  start_time: string;
  start_lat: number;
  start_lng: number;
};

export class JornadaError extends Error {
  constructor(public code: "GPS_PERMISSION_DENIED" | "GPS_NOT_AVAILABLE") {
    super(code);
  }
}

export function useJornada(inspectorId: string, location: GeoPoint | null) {
  const [active, setActive] = useState<ActiveJornada | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRef = useRef<GeoPoint | null>(location);

  // Keep location ref current
  useEffect(() => { locationRef.current = location; }, [location]);

  // Load persisted jornada on mount
  useEffect(() => {
    AsyncStorage.getItem(JORNADA_KEY).then((raw) => {
      if (!raw) return;
      try {
        const j: ActiveJornada = JSON.parse(raw);
        if (j.inspector_id === inspectorId) setActive(j);
      } catch {}
    });
  }, [inspectorId]);

  // Live elapsed timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (active) {
      const tick = () =>
        setElapsed(Math.floor((Date.now() - new Date(active.start_time).getTime()) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  // Periodic GPS update while jornada is active (every 5 min)
  useEffect(() => {
    if (!active) return;
    const sendLocation = async () => {
      const loc = locationRef.current;
      if (!loc) return;
      await sendNow(`${API_URL}/mobile/jornada/location`, "POST", {
        jornada_id: active.id,
        inspector_id: active.inspector_id,
        lat: loc.lat,
        lng: loc.lng,
      }, "jornada_location");
    };
    // Send immediately when jornada starts, then every 5 min
    sendLocation();
    const id = setInterval(sendLocation, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    // 1. Verify GPS permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new JornadaError("GPS_PERMISSION_DENIED");
    }

    // 2. Get current GPS position (required)
    let gpsLat: number;
    let gpsLng: number;

    if (locationRef.current) {
      gpsLat = locationRef.current.lat;
      gpsLng = locationRef.current.lng;
    } else {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 0,
          distanceInterval: 0,
        });
        gpsLat = pos.coords.latitude;
        gpsLng = pos.coords.longitude;
      } catch {
        throw new JornadaError("GPS_NOT_AVAILABLE");
      }
    }

    // 3. Create jornada
    const jornada: ActiveJornada = {
      id: `j_${Date.now()}`,
      inspector_id: inspectorId,
      start_time: new Date().toISOString(),
      start_lat: gpsLat,
      start_lng: gpsLng,
    };

    await AsyncStorage.setItem(JORNADA_KEY, JSON.stringify(jornada));
    setActive(jornada);

    await sendNow(`${API_URL}/mobile/jornada`, "POST", {
      id: jornada.id,
      inspector_id: inspectorId,
      start_time: jornada.start_time,
      start_lat: gpsLat,
      start_lng: gpsLng,
    }, "jornada");
  };

  const end = async () => {
    if (!active) return;
    const loc = locationRef.current;
    const end_time = new Date().toISOString();
    await sendNow(`${API_URL}/mobile/jornada`, "PATCH", {
      id: active.id,
      end_time,
      end_lat: loc?.lat ?? null,
      end_lng: loc?.lng ?? null,
    }, "jornada");
    await AsyncStorage.removeItem(JORNADA_KEY);
    setActive(null);
  };

  const formatElapsed = () => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return { active, elapsed, start, end, formatElapsed };
}
