import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList, Inspection, Inspector, Ruta } from "../types";
import { API_URL } from "../constants/api";
import { useOfflineSync, getPendingCount } from "../hooks/useOfflineSync";
import { useLocation } from "../hooks/useLocation";
import { useConnectivity } from "../hooks/useConnectivity";
import { useJornada, JornadaError } from "../hooks/useJornada";
import { useTheme } from "../hooks/useTheme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
  route: { params: { inspectorId: string } };
};

const RED = "#CE0D0D";

export default function HomeScreen({ navigation, route }: Props) {
  const { inspectorId } = route.params;
  const T = useTheme();

  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const { location, granted: gpsGranted } = useLocation();
  const { isOnline, status: connStatus } = useConnectivity();
  const { active: jornada, start: startJornada, end: endJornada, formatElapsed } = useJornada(inspectorId, location);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [iRes, insRes, rutasRes] = await Promise.all([
        axios.get<Inspector>(`${API_URL}/inspectors/${inspectorId}`),
        axios.get<Inspection[]>(`${API_URL}/inspections?inspector=${inspectorId}`),
        axios.get<Ruta[]>(`${API_URL}/mobile/rutas?inspector_id=${inspectorId}`),
      ]);
      setInspector(iRes.data);
      setInspections(Array.isArray(insRes.data) ? insRes.data : []);
      setRutas(Array.isArray(rutasRes.data) ? rutasRes.data : []);
    } catch {
      // If offline, keep existing data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [inspectorId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useOfflineSync((synced) => {
    setPendingCount(0);
    load(true);
    Alert.alert("✅ Sincronizado", `${synced} elemento(s) enviado(s) al servidor.`);
  });

  useEffect(() => { getPendingCount().then(setPendingCount); }, []);

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir", style: "destructive",
        onPress: async () => {
          try { await axios.post(`${API_URL}/mobile/logout`); } catch {}
          axios.defaults.headers.common["Authorization"] = undefined;
          await AsyncStorage.multiRemove([
            "masi_user", "masi_token", "inspector_id", "inspector_name",
            "masi_offline_queue_v2", "offline_inspection_queue", "masi_active_jornada",
          ]);
          navigation.replace("Login");
        },
      },
    ]);
  };

  const handleEndJornada = () => {
    Alert.alert(
      "Finalizar jornada",
      `¿Terminar turno? Duración: ${formatElapsed()}`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Finalizar", style: "destructive", onPress: endJornada },
      ]
    );
  };

  const today = new Date();
  const todayCount = inspections.filter((i) => {
    if (!i.submitted_at) return false;
    return new Date(i.submitted_at).toDateString() === today.toDateString();
  }).length;

  const resultColor = (r: Inspection["overall_result"]) =>
    r === "PASS" ? "#00875A" : r === "FAIL" ? RED : "#E07B00";
  const resultLabel = (r: Inspection["overall_result"]) =>
    r === "PASS" ? "APROBADO" : r === "FAIL" ? "RECHAZADO" : "CONDICIONAL";

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: T.bg }}>
        <ActivityIndicator size="large" color="#122B60" />
      </View>
    );
  }

  const h = today.getHours();
  const greeting = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

  // Connectivity banner config
  const bannerConfig = {
    offline:  { bg: "#92400E", text: "📵 Sin señal — datos guardados localmente" },
    restored: { bg: "#065F46", text: "✅ Señal restaurada — sincronizando datos..." },
    online:   null,
  }[connStatus];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={["top"]}>
      {/* Header */}
      <LinearGradient
        colors={T.isDark ? ["#050C1A", "#0D1B3E", "#122B60"] : ["#0D1B3E", "#122B60", "#1a3575"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{greeting},</Text>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 2, letterSpacing: -0.3 }}>
              {inspector?.name ?? "Inspector"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 3, textTransform: "capitalize" }}>
              {today.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.07)", marginTop: 4 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" }}>Salir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("Manual", { role: "inspector", userName: inspector?.name ?? "Inspector" })}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(255,255,255,0.07)", marginTop: 4, marginLeft: 6 }}
          >
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" }}>📖 Manual</Text>
          </TouchableOpacity>
        </View>

        {/* GPS + connectivity status pills */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: gpsGranted && location ? "#34D399" : "#F87171" }} />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>
              {gpsGranted && location
                ? `GPS ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : gpsGranted ? "Obteniendo GPS..." : "Sin permiso GPS"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOnline ? "#34D399" : "#F87171" }} />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>
              {isOnline ? "Con señal" : "Sin señal"}
            </Text>
          </View>
        </View>

        {/* Connectivity + sync banners — inside header so stats card siempre solapa el header */}
        {bannerConfig && (
          <View style={{ marginTop: 12, backgroundColor: bannerConfig.bg, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" }}>
              {bannerConfig.text}
            </Text>
          </View>
        )}
        {pendingCount > 0 && isOnline && (
          <View style={{ marginTop: 8, backgroundColor: "#1D4ED8", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" }}>
              🔄 {pendingCount} elemento(s) pendiente(s) de sincronizar
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            colors={["#122B60"]} tintColor={"#122B60"}
          />
        }
      >
      {/* Stats card */}
      <View style={{
        flexDirection: "row", backgroundColor: T.card,
        marginHorizontal: 16, marginTop: -16, borderRadius: 18,
        elevation: 8, shadowColor: "#000", shadowOpacity: T.isDark ? 0.4 : 0.12,
        shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, overflow: "hidden",
        borderWidth: T.isDark ? 1 : 0, borderColor: "rgba(255,255,255,0.06)",
      }}>
        {[
          { num: inspections.length, lbl: "Total", colors: ["#1E3A5F", "#3B82F6"] as const },
          { num: todayCount, lbl: "Hoy", colors: ["#064E3B", "#10B981"] as const },
          { num: inspections.filter((i) => i.overall_result === "FAIL").length, lbl: "Rechazados", colors: ["#7F1D1D", "#EF4444"] as const },
        ].map((s, idx) => (
          <View key={s.lbl} style={{ flex: 1, alignItems: "center", paddingVertical: 18, borderLeftWidth: idx > 0 ? 1 : 0, borderColor: T.isDark ? "rgba(255,255,255,0.06)" : "#F0F4FB" }}>
            <LinearGradient colors={s.colors} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>{s.num}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 11, color: T.textSub, fontWeight: "600", letterSpacing: 0.3 }}>{s.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Jornada card */}
      <View style={{
        marginHorizontal: 16, marginTop: 12, borderRadius: 16,
        overflow: "hidden", elevation: 4,
        shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
      }}>
        <LinearGradient
          colors={jornada ? ["#064E3B", "#065F46"] : ["#1E293B", "#334155"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Text style={{ fontSize: 28 }}>{jornada ? "🟢" : "🕐"}</Text>
          <View style={{ flex: 1 }}>
            {jornada ? (
              <>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Jornada activa</Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 20, fontWeight: "900", letterSpacing: 1, marginTop: 2 }}>
                  {formatElapsed()}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 }}>
                  Inicio: {new Date(jornada.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  {jornada.start_lat ? `  📍 ${jornada.start_lat.toFixed(4)}, ${jornada.start_lng?.toFixed(4)}` : ""}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Sin jornada activa</Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
                  Registra tu entrada para iniciar el turno
                </Text>
              </>
            )}
          </View>
          {jornada ? (
            <TouchableOpacity
              onPress={handleEndJornada}
              style={{ backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>Finalizar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await startJornada();
                } catch (e) {
                  const msg = e instanceof JornadaError && e.code === "GPS_PERMISSION_DENIED"
                    ? "Activa el permiso de ubicación para poder iniciar tu jornada. El GPS es obligatorio."
                    : "No se pudo obtener tu ubicación. Verifica que el GPS esté activado e intenta de nuevo.";
                  Alert.alert("GPS requerido 📍", msg);
                }
              }}
              style={{ backgroundColor: "#10B981", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>Iniciar</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>

      {/* Action buttons — 2 columns so caben todos en pantalla */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginTop: 6, gap: 8 }}>
        {[
          {
            colors: ["#CE0D0D", "#EF4444"] as const,
            shadow: RED,
            icon: "📷",
            title: "Inspección",
            sub: "Escanear QR",
            onPress: () => navigation.navigate("Scan", { inspectorId }),
          },
          {
            colors: ["#4C1D95", "#7C3AED"] as const,
            shadow: "#7C3AED",
            icon: "🤖",
            title: "MASI-IA",
            sub: "Asistente industrial",
            onPress: () => navigation.navigate("Chat", { userEmail: inspector?.email ?? "", userName: inspector?.name ?? "" }),
          },
          {
            colors: ["#1D4ED8", "#3B82F6"] as const,
            shadow: "#1D4ED8",
            icon: "📋",
            title: "Levantamiento",
            sub: "Nuevo / Ver",
            onPress: () => navigation.navigate("Levantamiento", { inspectorId }),
          },
          {
            colors: ["#065F46", "#059669"] as const,
            shadow: "#059669",
            icon: "🔧",
            title: "Taller",
            sub: "Órdenes asignadas",
            onPress: () => navigation.navigate("Taller", { inspectorId, userName: inspector?.name ?? "" }),
          },
        ].map((btn) => (
          <TouchableOpacity
            key={btn.title}
            style={{ width: "47%", borderRadius: 14, overflow: "hidden",
              elevation: 5, shadowColor: btn.shadow, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
            onPress={btn.onPress}
            activeOpacity={0.85}
          >
            <LinearGradient colors={btn.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ alignItems: "center", paddingHorizontal: 12, paddingVertical: 16, gap: 6 }}
            >
              <Text style={{ fontSize: 28 }}>{btn.icon}</Text>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textAlign: "center" }} numberOfLines={1}>{btn.title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, textAlign: "center" }} numberOfLines={1}>{btn.sub}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rutas asignadas */}
      {rutas.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: "700", color: T.textSub, letterSpacing: 0.5, textTransform: "uppercase", marginHorizontal: 16, marginTop: 20, marginBottom: 8 }}>
            Mis rutas asignadas
          </Text>
          {rutas.map(r => {
            const total = Number(r.total_items) || 0;
            const done  = Number(r.done_items) || 0;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            const isActive = r.status === "en_proceso" || r.status === "programada";
            return (
              <TouchableOpacity
                key={r.id}
                style={{
                  marginHorizontal: 16, marginBottom: 8,
                  backgroundColor: T.card, borderRadius: 14, padding: 14,
                  borderWidth: isActive ? 1.5 : 1,
                  borderColor: isActive ? "#3B82F6" : T.border,
                  elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
                }}
                onPress={() => navigation.navigate("Route", { inspectorId, ruta: r })}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: T.text }} numberOfLines={1}>{r.name}</Text>
                    <Text style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{r.cliente_name}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: isActive ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: isActive ? "#3B82F6" : "#10B981" }}>
                      {r.status === "completada" ? "COMPLETADA" : r.status === "en_proceso" ? "EN PROCESO" : "PROGRAMADA"}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1, height: 6, backgroundColor: T.border, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct === 100 ? "#10B981" : "#3B82F6", borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: T.textSub, minWidth: 42 }}>{done}/{total}</Text>
                  {r.scheduled_date && (
                    <Text style={{ fontSize: 11, color: T.textSub }}>
                      📅 {new Date(r.scheduled_date + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      <Text style={{
        fontSize: 13, fontWeight: "700", color: T.textSub, letterSpacing: 0.5,
        textTransform: "uppercase", marginHorizontal: 16, marginTop: 24, marginBottom: 10,
      }}>
        Inspecciones recientes
      </Text>

      {inspections.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: T.textSub }}>Sin inspecciones registradas.</Text>
          <Text style={{ fontSize: 13, color: T.textSub, marginTop: 6, textAlign: "center" }}>Escanea un equipo para comenzar.</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {inspections.slice(0, 20).map(item => (
            <View key={item.id} style={{
              backgroundColor: T.card, borderRadius: 12, padding: 14, marginBottom: 10,
              flexDirection: "row", alignItems: "center",
              elevation: 2, shadowColor: "#000", shadowOpacity: T.isDark ? 0.2 : 0.05,
              shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
              borderWidth: T.isDark ? 1 : 0, borderColor: T.border,
            }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: T.text }} numberOfLines={1}>
                  {item.equipment_name || `Equipo #${item.equipment_id.slice(0, 8)}`}
                </Text>
                {item.submitted_at && (
                  <Text style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>
                    {new Date(item.submitted_at).toLocaleString("es-MX")}
                  </Text>
                )}
                {item.notes ? (
                  <Text style={{ fontSize: 12, color: T.textSub, marginTop: 3, fontStyle: "italic" }} numberOfLines={1}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: resultColor(item.overall_result) }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
                  {resultLabel(item.overall_result)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
