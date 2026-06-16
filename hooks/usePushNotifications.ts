import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import axios from "axios";
import { API_URL } from "../constants/api";

// Handler set globally in App.tsx — do not duplicate here

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token);
        if (userId) {
          axios.post(`${API_URL}/push-token`, { user_id: userId, token, platform: Platform.OS })
            .catch(() => {});
        }
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  return { expoPushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MASI Alertas",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#122B60",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}
