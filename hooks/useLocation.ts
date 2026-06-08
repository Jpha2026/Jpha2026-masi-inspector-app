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

      // Get initial position quickly
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined });

      // Watch for updates
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? undefined });
        }
      );
    })();

    return () => { sub?.remove(); };
  }, []);

  return { location, granted };
}
