import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Solicitud } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "MisSolicitudes">;
  route: RouteProp<RootStackParamList, "MisSolicitudes">;
};

const TIPO_MAP: Record<string, { label: string; color: string; icon: string }> = {
  vacaciones:          { label: "Vacaciones",           color: "#2563EB", icon: "🏖️" },
  permiso_con_goce:    { label: "Permiso con goce",     color: "#059669", icon: "✅" },
  permiso_sin_goce:    { label: "Permiso sin goce",     color: "#D97706", icon: "⏸️" },
  llegada_tarde:       { label: "Llegada tarde",        color: "#F97316", icon: "⏰" },
  prestamo:            { label: "Préstamo",             color: "#7C3AED", icon: "💵" },
  incapacidad:         { label: "Incapacidad",          color: "#DC2626", icon: "🏥" },
  otro:                { label: "Otro",                 color: "#6B7280", icon: "📋" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente",  color: "#D97706" },
  aprobado:  { label: "Aprobado",   color: "#059669" },
  rechazado: { label: "Rechazado",  color: "#DC2626" },
};

export default function MisSolicitudesScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const load = async (isRefresh = false) => {
    if (!user.employee_id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await axios.get<Solicitud[]>(`${API_URL}/mobile/solicitudes?employee_id=${user.employee_id}`);
      setSolicitudes(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const cardBg  = T.isDark ? "#1A2740" : "#fff";
  const cardBdr = T.isDark ? "#243556" : "#E2E8F5";

  return (
    <LinearGradient colors={T.isDark ? ["#050C1A", "#0D1B3E"] as const : ["#F0F4FA", "#E8EFF8"] as const} style={{ flex: 1 }}>
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Mis Solicitudes</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("NuevaSolicitud", { user })}
          style={s.addBtn}
        >
          <Text style={s.addText}>+ Nueva</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#3B82F6" />}
        >
          {solicitudes.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: cardBg, borderColor: cardBdr }]}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>📭</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 14, textAlign: "center" }}>
                Aún no tienes solicitudes.{"\n"}Crea una nueva con el botón de arriba.
              </Text>
            </View>
          ) : (
            solicitudes.map((sol) => {
              const tipo   = TIPO_MAP[sol.tipo]   ?? TIPO_MAP.otro;
              const estado = STATUS_MAP[sol.status] ?? STATUS_MAP.pendiente;
              return (
                <View key={sol.id} style={[s.solCard, { backgroundColor: cardBg, borderColor: cardBdr }]}>
                  <View style={s.solTop}>
                    <Text style={{ fontSize: 26 }}>{tipo.icon}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.solTipo, { color: tipo.color }]}>{tipo.label}</Text>
                      <Text style={[s.solFolio, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                        {sol.folio}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: estado.color + "22" }]}>
                      <Text style={[s.badgeText, { color: estado.color }]}>{estado.label}</Text>
                    </View>
                  </View>

                  <View style={[s.solDetails, { borderColor: T.isDark ? "#1D3050" : "#EEF2FB" }]}>
                    <View style={s.detailRow}>
                      <Text style={[s.detailLbl, { color: T.isDark ? "#3D5A7A" : "#8A9BBE" }]}>Inicio</Text>
                      <Text style={[s.detailVal, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>{sol.fecha_inicio}</Text>
                    </View>
                    {sol.fecha_fin && (
                      <View style={s.detailRow}>
                        <Text style={[s.detailLbl, { color: T.isDark ? "#3D5A7A" : "#8A9BBE" }]}>Fin</Text>
                        <Text style={[s.detailVal, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>{sol.fecha_fin}</Text>
                      </View>
                    )}
                    {sol.dias != null && (
                      <View style={s.detailRow}>
                        <Text style={[s.detailLbl, { color: T.isDark ? "#3D5A7A" : "#8A9BBE" }]}>Días</Text>
                        <Text style={[s.detailVal, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>{sol.dias}</Text>
                      </View>
                    )}
                    {sol.monto != null && (
                      <View style={s.detailRow}>
                        <Text style={[s.detailLbl, { color: T.isDark ? "#3D5A7A" : "#8A9BBE" }]}>Monto</Text>
                        <Text style={[s.detailVal, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>
                          ${Number(sol.monto).toLocaleString("es-MX")}
                        </Text>
                      </View>
                    )}
                    {sol.motivo ? (
                      <View style={s.detailRow}>
                        <Text style={[s.detailLbl, { color: T.isDark ? "#3D5A7A" : "#8A9BBE" }]}>Motivo</Text>
                        <Text style={[s.detailVal, { color: T.isDark ? "#C4D8EE" : "#1A2740", flex: 1 }]} numberOfLines={3}>
                          {sol.motivo}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {sol.foto_url ? (
                    <Image
                      source={{ uri: sol.foto_url }}
                      style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 10 }}
                      resizeMode="cover"
                    />
                  ) : null}

                  {sol.notas_rh ? (
                    <View style={[s.rhBox, { backgroundColor: T.isDark ? "#0D1B3E" : "#EFF6FF" }]}>
                      <Text style={[s.rhText, { color: T.isDark ? "#60A5FA" : "#1D4ED8" }]}>
                        💬 RH: {sol.notas_rh}
                      </Text>
                    </View>
                  ) : null}

                  {sol.aprobado_por ? (
                    <Text style={[s.approvedBy, { color: T.isDark ? "#3D5A7A" : "#9BACC8" }]}>
                      {sol.status === "aprobado" ? "✅" : "❌"} {sol.aprobado_por}
                      {sol.fecha_resolucion ? ` · ${sol.fecha_resolucion}` : ""}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nav:        { paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:    { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:  { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:   { color: "#fff", fontSize: 17, fontWeight: "800" },
  addBtn:     { backgroundColor: "#CE0D0D", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addText:    { color: "#fff", fontWeight: "800", fontSize: 13 },
  emptyCard:  { borderRadius: 14, padding: 40, alignItems: "center", borderWidth: 1, marginTop: 20 },
  solCard:    { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  solTop:     { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  solTipo:    { fontSize: 15, fontWeight: "700" },
  solFolio:   { fontSize: 11, marginTop: 2 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:  { fontSize: 11, fontWeight: "700" },
  solDetails: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  detailRow:  { flexDirection: "row", gap: 8 },
  detailLbl:  { fontSize: 12, fontWeight: "600", width: 60 },
  detailVal:  { fontSize: 12, flex: 1 },
  rhBox:      { borderRadius: 8, padding: 8, marginTop: 10 },
  rhText:     { fontSize: 12, lineHeight: 16 },
  approvedBy: { fontSize: 11, marginTop: 8 },
});
