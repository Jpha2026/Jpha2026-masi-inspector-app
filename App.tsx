import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import axios from "axios";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ScanScreen from "./screens/ScanScreen";
import InspectionScreen from "./screens/InspectionScreen";
import LevantamientoScreen from "./screens/LevantamientoScreen";
import EmpleadoHomeScreen from "./screens/EmpleadoHomeScreen";
import MisSolicitudesScreen from "./screens/MisSolicitudesScreen";
import NuevaSolicitudScreen from "./screens/NuevaSolicitudScreen";
import TallerScreen from "./screens/TallerScreen";
import RouteScreen from "./screens/RouteScreen";
import ChatScreen from "./screens/ChatScreen";
import PedidoScreen from "./screens/PedidoScreen";
import MisPedidosScreen from "./screens/MisPedidosScreen";

import { RootStackParamList, AppUser } from "./types";
import { API_URL } from "./constants/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken(userId: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await axios.post(`${API_URL}/mobile/push-token`, {
      user_id: userId,
      token: tokenData.data,
      platform: Platform.OS,
    });
  } catch {}
}

const Stack = createNativeStackNavigator<RootStackParamList>();

type InitRoute = "Login" | "Home" | "EmpleadoHome";

export default function App() {
  const [initialRoute, setInitialRoute] = useState<InitRoute | null>(null);
  const [savedInspectorId, setSavedInspectorId] = useState<string | null>(null);
  const [savedUser, setSavedUser] = useState<AppUser | null>(null);
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const userJson = await AsyncStorage.getItem("masi_user");
      if (userJson) {
        try {
          const user: AppUser = JSON.parse(userJson);
          if (user.role === "empleado") {
            setSavedUser(user);
            setInitialRoute("EmpleadoHome");
            registerPushToken(user.id);
            return;
          }
          if (user.inspector_id) {
            setSavedInspectorId(user.inspector_id);
            setInitialRoute("Home");
            registerPushToken(user.inspector_id);
            return;
          }
        } catch {}
      }
      const id = await AsyncStorage.getItem("inspector_id");
      if (id) {
        setSavedInspectorId(id);
        setInitialRoute("Home");
        registerPushToken(id);
      } else {
        setInitialRoute("Login");
      }
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#122B60" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            initialParams={
              initialRoute === "Home" && savedInspectorId
                ? { inspectorId: savedInspectorId }
                : undefined
            }
          />
          <Stack.Screen name="Scan" component={ScanScreen} />
          <Stack.Screen name="Inspection" component={InspectionScreen} />
          <Stack.Screen name="Levantamiento" component={LevantamientoScreen} />
          <Stack.Screen
            name="EmpleadoHome"
            component={EmpleadoHomeScreen}
            initialParams={
              initialRoute === "EmpleadoHome" && savedUser
                ? { user: savedUser }
                : undefined
            }
          />
          <Stack.Screen name="MisSolicitudes" component={MisSolicitudesScreen} />
          <Stack.Screen name="NuevaSolicitud" component={NuevaSolicitudScreen} />
          <Stack.Screen name="Pedido" component={PedidoScreen} />
          <Stack.Screen name="MisPedidos" component={MisPedidosScreen} />
          <Stack.Screen name="Taller" component={TallerScreen} />
          <Stack.Screen name="Route" component={RouteScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
