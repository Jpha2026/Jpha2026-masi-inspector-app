import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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
import SciServiceScreen from "./screens/SciServiceScreen";
import RouteScreen from "./screens/RouteScreen";
import ChatScreen from "./screens/ChatScreen";
import PedidoScreen from "./screens/PedidoScreen";
import MisPedidosScreen from "./screens/MisPedidosScreen";
import AsistenciaScreen from "./screens/AsistenciaScreen";
import ClienteHomeScreen from "./screens/ClienteHomeScreen";
import ClienteEquiposScreen from "./screens/ClienteEquiposScreen";
import ClienteInspeccionesScreen from "./screens/ClienteInspeccionesScreen";
import ClienteCotizacionesScreen from "./screens/ClienteCotizacionesScreen";
import NominaScreen from "./screens/NominaScreen";
import PrestamosScreen from "./screens/PrestamosScreen";
import NuevoLeadScreen from "./screens/NuevoLeadScreen";
import POSScreen from "./screens/POSScreen";
import ActivosScreen from "./screens/ActivosScreen";
import VendedorHomeScreen from "./screens/VendedorHomeScreen";
import ManualScreen from "./screens/ManualScreen";

import { RootStackParamList, AppUser } from "./types";
import { API_URL } from "./constants/api";

axios.defaults.timeout = 15000;

axios.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      axios.defaults.headers.common["Authorization"] = undefined;
      await SecureStore.deleteItemAsync("masi_token");
      await SecureStore.deleteItemAsync("masi_user");
      await SecureStore.deleteItemAsync("masi_active_jornada");
      await SecureStore.deleteItemAsync("inspector_id");
      await SecureStore.deleteItemAsync("inspector_name");
      await AsyncStorage.multiRemove([
        "masi_user", "inspector_id", "inspector_name",
        "masi_offline_queue_v2", "offline_inspection_queue", "masi_active_jornada",
      ]);
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    }
    return Promise.reject(error);
  }
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken(_userId: string) {
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
      token: tokenData.data,
      platform: Platform.OS,
    });
  } catch {}
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

type InitRoute = "Login" | "Home" | "EmpleadoHome" | "ClienteHome" | "VendedorHome" | "Taller";

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
      // Restore session token and validate server-side
      const token = await SecureStore.getItemAsync("masi_token");
      if (token) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          await axios.get(`${API_URL}/mobile/me`);
        } catch (e: unknown) {
          if (axios.isAxiosError(e) && (e.response || e.code === "ECONNABORTED")) {
            await SecureStore.deleteItemAsync("masi_token");
            await SecureStore.deleteItemAsync("masi_user");
            await SecureStore.deleteItemAsync("masi_active_jornada");
            await SecureStore.deleteItemAsync("inspector_id");
            await SecureStore.deleteItemAsync("inspector_name");
            await AsyncStorage.multiRemove([
              "masi_user", "inspector_id", "inspector_name",
              "masi_offline_queue_v2", "offline_inspection_queue", "masi_active_jornada",
            ]);
            axios.defaults.headers.common["Authorization"] = undefined;
            setInitialRoute("Login");
            return;
          }
          // Pure network error (server unreachable) — let through with cached session
        }
      }

      const userJson = await SecureStore.getItemAsync("masi_user");
      if (userJson) {
        try {
          const user: AppUser = JSON.parse(userJson);
          if (user.role === "empleado") {
            setSavedUser(user);
            setInitialRoute("EmpleadoHome");
            registerPushToken(user.id);
            return;
          }
          if (user.role === "cliente") {
            setSavedUser(user);
            setInitialRoute("ClienteHome");
            registerPushToken(user.id);
            return;
          }
          if (user.role === "vendedor") {
            setSavedUser(user);
            setInitialRoute("VendedorHome");
            registerPushToken(user.id);
            return;
          }
          if (user.role === "taller" || user.role === "ventas") {
            setSavedUser(user);
            setInitialRoute("Taller");
            registerPushToken(user.inspector_id ?? user.id);
            return;
          }
          if (user.role === "supervisor") {
            setSavedInspectorId(user.inspector_id ?? user.id);
            setInitialRoute("Home");
            registerPushToken(user.inspector_id ?? user.id);
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
      const id = await SecureStore.getItemAsync("inspector_id");
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
      <NavigationContainer ref={navigationRef}>
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
          <Stack.Screen name="Asistencia" component={AsistenciaScreen} />
          <Stack.Screen
            name="ClienteHome"
            component={ClienteHomeScreen}
            initialParams={
              initialRoute === "ClienteHome" && savedUser
                ? { user: savedUser }
                : undefined
            }
          />
          <Stack.Screen name="ClienteEquipos" component={ClienteEquiposScreen} />
          <Stack.Screen name="ClienteInspecciones" component={ClienteInspeccionesScreen} />
          <Stack.Screen name="ClienteCotizaciones" component={ClienteCotizacionesScreen} />
          <Stack.Screen name="Nomina" component={NominaScreen} />
          <Stack.Screen name="Prestamos" component={PrestamosScreen} />
          <Stack.Screen
            name="Taller"
            component={TallerScreen}
            initialParams={
              initialRoute === "Taller" && savedUser
                ? { inspectorId: savedUser.inspector_id ?? savedUser.id, userName: savedUser.name }
                : undefined
            }
          />
          <Stack.Screen name="SciService" component={SciServiceScreen} />
          <Stack.Screen name="Route" component={RouteScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="NuevoLead" component={NuevoLeadScreen} />
          <Stack.Screen name="POS" component={POSScreen} />
          <Stack.Screen name="Activos" component={ActivosScreen} />
          <Stack.Screen
            name="VendedorHome"
            component={VendedorHomeScreen}
            initialParams={
              initialRoute === "VendedorHome" && savedUser
                ? { user: savedUser }
                : undefined
            }
          />
          <Stack.Screen name="Manual" component={ManualScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
