import { useState, useEffect } from "react";
import * as Location from "expo-location";

export type GeoPoint = { lat: number; lng: number; accuracy?: number };

export function useLocation() {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      setGranted(true);

      // Use last known position immediately (instant, no GPS wait)
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      if (last) setLocation({ lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? undefined });

      // Watch for updates using network/WiFi first (Accuracy.Low = fast, ~1-2s)
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Low, timeInterval: 30000, distanceInterval: 50 },
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined });
        }
      );
    })();

    return () => { sub?.remove(); };
  }, []);

  return { location, granted };
}
