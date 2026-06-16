import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, AppUser } from "../types";
import { API_URL } from "../constants/api";
import axios from "axios";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ClienteHome">;
  route: { params: { user: AppUser } };
};

type Stats = {
  total_equipos: number;
  inspecciones_mes: number;
  ultima_inspeccion: string | null;
  cotizaciones_pendientes: number;
};

type ClientInfo = {
  name: string;
  vendedor_name: string;
  tel_atencion: string;
  phone: string;
  whatsapp: string;
};

export default function ClienteHomeScreen({ navigation, route }: Props) {
  const { user } = route.params;
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentInspections, setRecentInspections] = useState<{
    id: string; overall_result: string; equipment_name: string;
    submitted_at: string; inspector_name: string; equipment_id: string;
  }[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.client_id) return;
    (async () => {
      try {
        const [equipRes, inspRes, cotRes] = await Promise.all([
          axios.get(`${API_URL}/mobile/cliente/equipos?client_id=${user.client_id}`),
          axios.get(`${API_URL}/mobile/cliente/inspecciones?client_id=${user.client_id}`),
          axios.get(`${API_URL}/mobile/cliente/cotizaciones?client_id=${user.client_id}`),
        ]);
        const equipos = equipRes.data.data ?? [];
        const inspecciones = inspRes.data.data ?? [];
        if (equipRes.data.clientInfo) setClientInfo(equipRes.data.clientInfo);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const insMes = inspecciones.filter((i: { submitted_at: string }) => i.submitted_at >= monthStart);
        const last = inspecciones[0]?.submitted_at ?? null;
        setStats({
          total_equipos: equipos.length,
          inspecciones_mes: insMes.length,
          ultima_inspeccion: last ? last.slice(0, 10) : null,
          cotizaciones_pendientes: cotRes.data.stats?.pendientes ?? 0,
        });
        setRecentInspections(inspecciones.slice(0, 5));
      } catch {
        Alert.alert("Error", "No se pudo cargar la información");
      } finally {
        setLoading(false);
      }
    })();
  }, [user.client_id]);

  async function logout() {
    try { await axios.post(`${API_URL}/mobile/logout`); } catch {}
    axios.defaults.headers.common["Authorization"] = undefined;
    await SecureStore.deleteItemAsync("masi_token");
    await SecureStore.deleteItemAsync("masi_active_jornada");
    await AsyncStorage.multiRemove([
      "masi_user", "inspector_id", "inspector_name",
      "masi_offline_queue_v2", "offline_inspection_queue", "masi_active_jornada",
    ]);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  const resultColor = (r: string) =>
    r === "PASS" ? "#10B981" : r === "FAIL" ? "#EF4444" : "#F59E0B";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bienvenido,</Text>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.subtitle}>Portal Cliente · MASI</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Manual", { role: "cliente", userName: user.name })} style={[styles.logoutBtn, { marginRight: 6, backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 13 }}>📖 Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#fff" size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPIs */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{stats?.total_equipos ?? 0}</Text>
                <Text style={styles.kpiLabel}>Equipos</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{stats?.inspecciones_mes ?? 0}</Text>
                <Text style={styles.kpiLabel}>Insp. mes</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{stats?.cotizaciones_pendientes ?? 0}</Text>
                <Text style={styles.kpiLabel}>Cotiz. pendientes</Text>
              </View>
            </View>

            {/* Acciones 2x2 */}
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#1E40AF" }]}
                onPress={() => navigation.navigate("ClienteEquipos", { user })}
              >
                <Text style={styles.actionIcon}>🧯</Text>
                <Text style={styles.actionLabel}>Mis Equipos</Text>
                <Text style={styles.actionDesc}>Equipos registrados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#065F46" }]}
                onPress={() => navigation.navigate("ClienteInspecciones", { user })}
              >
                <Text style={styles.actionIcon}>🔍</Text>
                <Text style={styles.actionLabel}>Inspecciones</Text>
                <Text style={styles.actionDesc}>Historial de reportes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#7C3AED" }]}
                onPress={() => navigation.navigate("ClienteCotizaciones", { user })}
              >
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionLabel}>Cotizaciones</Text>
                <Text style={styles.actionDesc}>Ver y aprobar propuestas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: "#B45309" }]}
                onPress={() => Linking.openURL("https://wa.me/528189973328?text=Hola%20MASI%2C%20soy%20cliente%20y%20necesito%20apoyo")}
              >
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionLabel}>Contacto</Text>
                <Text style={styles.actionDesc}>WhatsApp soporte</Text>
              </TouchableOpacity>
            </View>

            {/* Ejecutivo asignado */}
            {(clientInfo?.vendedor_name || clientInfo?.tel_atencion) && (
              <View style={styles.section} >
                <Text style={styles.sectionTitle}>Tu ejecutivo MASI</Text>
                {clientInfo.vendedor_name ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                    <View>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{clientInfo.vendedor_name}</Text>
                      <Text style={{ color: "#6B88A8", fontSize: 12 }}>Ejecutivo de cuenta</Text>
                    </View>
                  </View>
                ) : null}
                {clientInfo.tel_atencion ? (
                  <View style={{ gap: 6 }}>
                    {clientInfo.tel_atencion.split(",").map((t, i) => (
                      <TouchableOpacity
                        key={i}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                        onPress={() => Linking.openURL(`tel:${t.trim()}`)}
                      >
                        <Text style={{ fontSize: 16 }}>📞</Text>
                        <Text style={{ color: "#3B82F6", fontSize: 13, textDecorationLine: "underline" }}>{t.trim()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {/* Últimas inspecciones */}
            {recentInspections.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inspecciones Recientes</Text>
                {recentInspections.map(ins => (
                  <TouchableOpacity
                    key={ins.id}
                    style={styles.insRow}
                    onPress={() =>
                      navigation.navigate("ClienteInspecciones", {
                        user,
                        equipment_id: ins.equipment_id,
                        equipment_name: ins.equipment_name,
                      })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insEquip}>{ins.equipment_name}</Text>
                      <Text style={styles.insMeta}>
                        {ins.submitted_at.slice(0, 10)} · {ins.inspector_name}
                      </Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: resultColor(ins.overall_result) + "22" }]}>
                      <Text style={[styles.resultText, { color: resultColor(ins.overall_result) }]}>
                        {ins.overall_result}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#0A1628" },
  container:   { padding: 20, paddingBottom: 40 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  greeting:    { color: "#9FC3E8", fontSize: 14 },
  name:        { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  subtitle:    { color: "#4A6A90", fontSize: 12, marginTop: 2 },
  logoutBtn:   { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText:  { color: "#EF4444", fontWeight: "700", fontSize: 13 },
  kpiRow:      { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpiCard:     { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 14, alignItems: "center" },
  kpiValue:    { color: "#fff", fontSize: 20, fontWeight: "800" },
  kpiLabel:    { color: "#7A9CBF", fontSize: 11, marginTop: 3, textAlign: "center" },
  actionsRow:  { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  actionCard:  { width: "47%", borderRadius: 14, padding: 18, alignItems: "center" },
  actionIcon:  { fontSize: 28, marginBottom: 8 },
  actionLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  actionDesc:  { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 3, textAlign: "center" },
  section:     { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 16 },
  sectionTitle:{ color: "#9FC3E8", fontSize: 13, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  insRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  insEquip:    { color: "#fff", fontWeight: "600", fontSize: 14 },
  insMeta:     { color: "#6B88A8", fontSize: 12, marginTop: 2 },
  resultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  resultText:  { fontWeight: "800", fontSize: 12 },
});
