import { useState, useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";

export type ConnectivityState = "online" | "offline" | "restored";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [status, setStatus] = useState<ConnectivityState>("online");
  const wasOfflineRef = useRef(false);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const connected = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(connected);
      if (!connected) {
        setStatus("offline");
        wasOfflineRef.current = true;
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      setIsOnline(connected);

      if (!connected) {
        setStatus("offline");
        wasOfflineRef.current = true;
        if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      } else if (wasOfflineRef.current) {
        setStatus("restored");
        wasOfflineRef.current = false;
        restoredTimerRef.current = setTimeout(() => setStatus("online"), 4000);
      } else {
        setStatus("online");
      }
    });

    return () => {
      unsubscribe();
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
    };
  }, []);

  return { isOnline, status };
}
