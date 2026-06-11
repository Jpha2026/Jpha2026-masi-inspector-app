import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Animated, Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Solicitud } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VacBalance = { days_total: number; days_used: number; days_pending: number; days_available: number };
type LoanSummary = { folio: string; monto_total: number; saldo: number };

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "EmpleadoHome">;
  route: RouteProp<RootStackParamList, "EmpleadoHome">;
};

const TIPO_MAP: Record<string, { label: string; color: string; icon: string }> = {
  vacaciones:          { label: "Vacaciones",           color: "#2563EB", icon: "🏖️" },
  permiso_con_goce:    { label: "Permiso con goce",     color: "#059669", icon: "✅" },
  permiso_sin_goce:    { label: "Permiso sin goce",     color: "#D97706", icon: "⏸️" },
  prestamo:            { label: "Préstamo",             color: "#7C3AED", icon: "💵" },
  incapacidad:         { label: "Incapacidad",          color: "#DC2626", icon: "🏥" },
  otro:                { label: "Otro",                 color: "#6B7280", icon: "📋" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente",  color: "#D97706" },
  aprobado:  { label: "Aprobado",   color: "#059669" },
  rechazado: { label: "Rechazado",  color: "#DC2626" },
};

export default function EmpleadoHomeScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [vacBalance, setVacBalance]   = useState<VacBalance | null>(null);
  const [loans, setLoans]             = useState<LoanSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadData = async () => {
    if (!user.employee_id) { setLoading(false); return; }
    try {
      const [solRes, vacRes, loanRes] = await Promise.allSettled([
        axios.get<Solicitud[]>(`${API_URL}/mobile/solicitudes?employee_id=${user.employee_id}`),
        axios.get<VacBalance>(`${API_URL}/mobile/vacation-balance?employee_id=${user.employee_id}`),
        axios.get<LoanSummary[]>(`${API_URL}/mobile/loan-balance?employee_id=${user.employee_id}`),
      ]);
      if (solRes.status === "fulfilled") setSolicitudes(solRes.value.data);
      if (vacRes.status === "fulfilled") setVacBalance(vacRes.value.data);
      if (loanRes.status === "fulfilled") setLoans(loanRes.value.data);
    } catch { /* silently fail */ } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir", style: "destructive", onPress: async () => {
          await AsyncStorage.multiRemove(["masi_user", "inspector_id", "inspector_name"]);
          navigation.replace("Login");
        },
      },
    ]);
  };

  const pending   = solicitudes.filter(s => s.status === "pendiente").length;
  const approved  = solicitudes.filter(s => s.status === "aprobado").length;
  const recent    = solicitudes.slice(0, 5);

  const bg = T.isDark
    ? ["#050C1A", "#0D1B3E", "#0f1e3a"] as const
    : ["#F0F4FA", "#E8EFF8", "#F0F4FA"] as const;

  return (
    <LinearGradient colors={bg} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerGreet}>Hola, {user.name.split(" ")[0]} 👋</Text>
              <Text style={s.headerRole}>Portal de Empleado · MASI</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("Manual", { role: "empleado", userName: user.name })} style={[s.logoutBtn, { marginRight: 6 }]}>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" }}>📖 Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "700" }}>Salir ⏏</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <Animated.View style={{ opacity: fadeAnim, padding: 16 }}>

          {/* Vacation balance banner */}
          {vacBalance && (
            <View style={[s.vacBanner, { backgroundColor: T.isDark ? "#0E2040" : "#EFF6FF", borderColor: T.isDark ? "#1E4080" : "#BFDBFE" }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.vacTitle, { color: T.isDark ? "#93C5FD" : "#1D4ED8" }]}>🏖️ Días de Vacaciones {new Date().getFullYear()}</Text>
                <View style={s.vacRow}>
                  <View style={s.vacStat}>
                    <Text style={[s.vacNum, { color: "#10B981" }]}>{vacBalance.days_available}</Text>
                    <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Disponibles</Text>
                  </View>
                  <View style={[s.vacDivider, { backgroundColor: T.isDark ? "#1E4080" : "#BFDBFE" }]} />
                  <View style={s.vacStat}>
                    <Text style={[s.vacNum, { color: "#EF4444" }]}>{vacBalance.days_used}</Text>
                    <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Usados</Text>
                  </View>
                  <View style={[s.vacDivider, { backgroundColor: T.isDark ? "#1E4080" : "#BFDBFE" }]} />
                  <View style={s.vacStat}>
                    <Text style={[s.vacNum, { color: "#D97706" }]}>{vacBalance.days_pending}</Text>
                    <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Pendientes</Text>
                  </View>
                  <View style={[s.vacDivider, { backgroundColor: T.isDark ? "#1E4080" : "#BFDBFE" }]} />
                  <View style={s.vacStat}>
                    <Text style={[s.vacNum, { color: T.isDark ? "#93C5FD" : "#1D4ED8" }]}>{vacBalance.days_total}</Text>
                    <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Total</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Loan banners */}
          {loans.length > 0 && loans.map(loan => (
            <View key={loan.folio} style={[s.vacBanner, { backgroundColor: T.isDark ? "#1D1040" : "#FAF5FF", borderColor: T.isDark ? "#3D1E80" : "#E9D5FF" }]}>
              <Text style={[s.vacTitle, { color: T.isDark ? "#A78BFA" : "#6D28D9" }]}>💵 Préstamo {loan.folio}</Text>
              <View style={s.vacRow}>
                <View style={s.vacStat}>
                  <Text style={[s.vacNum, { color: "#8B5CF6" }]}>${loan.monto_total.toLocaleString("es-MX")}</Text>
                  <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Total</Text>
                </View>
                <View style={[s.vacDivider, { backgroundColor: T.isDark ? "#3D1E80" : "#E9D5FF" }]} />
                <View style={s.vacStat}>
                  <Text style={[s.vacNum, { color: "#EF4444" }]}>${loan.saldo.toLocaleString("es-MX")}</Text>
                  <Text style={[s.vacLbl, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>Saldo</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={s.statNum}>{solicitudes.length}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Solicitudes</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={[s.statNum, { color: "#D97706" }]}>{pending}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Pendientes</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: T.isDark ? "#1E293B" : "#fff", borderColor: T.isDark ? "#2D3E56" : "#E2E8F5" }]}>
              <Text style={[s.statNum, { color: "#059669" }]}>{approved}</Text>
              <Text style={[s.statLbl, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>Aprobadas</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.actionCard}
              onPress={() => navigation.navigate("NuevaSolicitud", { user })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#CE0D0D", "#EF4444"]} style={s.actionGrad}>
                <Text style={s.actionIcon}>➕</Text>
                <Text style={s.actionLabel}>Nueva{"\n"}Solicitud</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionCard}
              onPress={() => navigation.navigate("MisSolicitudes", { user })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#1D4ED8", "#3B82F6"]} style={s.actionGrad}>
                <Text style={s.actionIcon}>📋</Text>
                <Text style={s.actionLabel}>Mis{"\n"}Solicitudes</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionCard}
              onPress={() => navigation.navigate("Pedido", { user })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#5B21B6", "#8B5CF6"]} style={s.actionGrad}>
                <Text style={s.actionIcon}>📦</Text>
                <Text style={s.actionLabel}>Pedir{"\n"}Insumos</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionCard}
              onPress={() => navigation.navigate("Chat", { userEmail: user.email, userName: user.name })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={["#065F46", "#10B981"]} style={s.actionGrad}>
                <Text style={s.actionIcon}>🤖</Text>
                <Text style={s.actionLabel}>MASI{"\n"}IA</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Secondary actions */}
          <View style={s.secondaryRow}>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#0A1E10" : "#F0FDF4", borderColor: T.isDark ? "#14532D" : "#BBF7D0" }]}
              onPress={() => navigation.navigate("Asistencia", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#4ADE80" : "#15803D" }]}>Registrar Asistencia</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#22C55E" : "#16A34A", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#1D1040" : "#F5F0FF", borderColor: T.isDark ? "#3D1E80" : "#C4B5FD", marginTop: 8 }]}
              onPress={() => navigation.navigate("MisPedidos", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>📦</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#A78BFA" : "#5B21B6" }]}>Mis Pedidos de Insumos</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#7C5ABD" : "#8B5CF6", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#1A0D30" : "#FAF5FF", borderColor: T.isDark ? "#4C1D95" : "#DDD6FE", marginTop: 8 }]}
              onPress={() => navigation.navigate("Nomina", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>💸</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#C4B5FD" : "#6D28D9" }]}>Mis Pagos (Nómina)</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#9D78F0" : "#7C3AED", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#0D1A10" : "#F0FFF4", borderColor: T.isDark ? "#14532D" : "#A7F3D0", marginTop: 8 }]}
              onPress={() => navigation.navigate("Prestamos", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>💵</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#6EE7B7" : "#065F46" }]}>Mis Préstamos</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#34D399" : "#059669", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#1A0A08" : "#FFF5F5", borderColor: T.isDark ? "#4A1010" : "#FECACA", marginTop: 8 }]}
              onPress={() => navigation.navigate("NuevoLead", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>📣</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#FCA5A5" : "#991B1B" }]}>Capturar Lead</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#EF4444" : "#DC2626", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: T.isDark ? "#0A1828" : "#EFF6FF", borderColor: T.isDark ? "#1E3A5F" : "#BFDBFE", marginTop: 8 }]}
              onPress={() => navigation.navigate("Activos", { user })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🏭</Text>
              <Text style={[s.secondaryLabel, { color: T.isDark ? "#93C5FD" : "#1D4ED8" }]}>Mis Activos</Text>
              <Text style={{ fontSize: 14, color: T.isDark ? "#60A5FA" : "#2563EB", marginLeft: "auto" as any }}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Recent solicitudes */}
          <Text style={[s.sectionTitle, { color: T.isDark ? "#60A5FA" : "#122B60" }]}>
            Solicitudes recientes
          </Text>

          {loading ? (
            <ActivityIndicator color="#3B82F6" style={{ marginTop: 20 }} />
          ) : recent.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: T.isDark ? "#1A2740" : "#F4F8FF", borderColor: T.isDark ? "#243556" : "#D5DCF0" }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 14 }}>
                Sin solicitudes aún
              </Text>
            </View>
          ) : (
            recent.map((sol) => {
              const tipo = TIPO_MAP[sol.tipo] ?? TIPO_MAP.otro;
              const estado = STATUS_MAP[sol.status] ?? STATUS_MAP.pendiente;
              return (
                <View key={sol.id} style={[s.solCard, {
                  backgroundColor: T.isDark ? "#1A2740" : "#fff",
                  borderColor: T.isDark ? "#243556" : "#E2E8F5",
                }]}>
                  <View style={s.solRow}>
                    <Text style={{ fontSize: 24 }}>{tipo.icon}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.solTipo, { color: tipo.color }]}>{tipo.label}</Text>
                      <Text style={[s.solFolio, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                        {sol.folio} · {sol.fecha_inicio}
                        {sol.dias ? ` · ${sol.dias} día(s)` : ""}
                      </Text>
                      {sol.motivo ? (
                        <Text style={[s.solMotivo, { color: T.isDark ? "#5A7A9A" : "#6B84A8" }]} numberOfLines={2}>
                          {sol.motivo}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: estado.color + "22" }]}>
                      <Text style={[s.statusText, { color: estado.color }]}>{estado.label}</Text>
                    </View>
                  </View>
                  {sol.notas_rh ? (
                    <View style={[s.rhNota, { backgroundColor: T.isDark ? "#0D1B3E" : "#EFF6FF" }]}>
                      <Text style={[s.rhNotaText, { color: T.isDark ? "#60A5FA" : "#1D4ED8" }]}>
                        💬 RH: {sol.notas_rh}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  vacBanner:    { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  vacTitle:     { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  vacRow:       { flexDirection: "row", alignItems: "center" },
  vacStat:      { flex: 1, alignItems: "center" },
  vacNum:       { fontSize: 22, fontWeight: "900" },
  vacLbl:       { fontSize: 10, fontWeight: "600", marginTop: 2 },
  vacDivider:   { width: 1, height: 36, marginHorizontal: 4 },
  header:       { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow:    { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  headerGreet:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerRole:   { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  logoutBtn:    { padding: 8 },
  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1 },
  statNum:      { fontSize: 26, fontWeight: "900", color: "#3B82F6" },
  statLbl:      { fontSize: 11, marginTop: 3, fontWeight: "600" },
  actionsRow:   { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionCard:   { flex: 1, borderRadius: 16, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  actionGrad:   { padding: 20, alignItems: "center", minHeight: 110, justifyContent: "center", gap: 8 },
  actionIcon:   { fontSize: 28 },
  actionLabel:  { color: "#fff", fontWeight: "800", fontSize: 14, textAlign: "center", lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  emptyCard:    { borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1 },
  solCard:      { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  solRow:       { flexDirection: "row", alignItems: "flex-start" },
  solTipo:      { fontSize: 14, fontWeight: "700" },
  solFolio:     { fontSize: 11, marginTop: 2 },
  solMotivo:    { fontSize: 12, marginTop: 4, lineHeight: 16 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: "700" },
  rhNota:       { marginTop: 10, borderRadius: 8, padding: 8 },
  rhNotaText:   { fontSize: 12, lineHeight: 16 },
  secondaryRow: { marginBottom: 20 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  secondaryLabel: { fontSize: 14, fontWeight: "700", flex: 1 },
});
