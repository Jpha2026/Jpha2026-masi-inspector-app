import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import * as Location from "expo-location";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Asistencia">;
  route: RouteProp<RootStackParamList, "Asistencia">;
};

type AttRecord = {
  id?: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
};

export default function AsistenciaScreen({ navigation, route }: Props) {
  const T = useTheme();
  const { user } = route.params;
  const [record, setRecord]     = useState<AttRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const [posting, setPosting]   = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!user.employee_id) { setLoading(false); return; }
    try {
      const res = await axios.get<AttRecord | null>(`${API_URL}/mobile/asistencia?employee_id=${user.employee_id}`);
      setRecord(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const registrar = async (tipo: "entrada" | "salida") => {
    if (!user.employee_id) return;
    setPosting(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {}

      await axios.post(`${API_URL}/mobile/asistencia`, { employee_id: user.employee_id, tipo, lat, lng });
      await load();
      Alert.alert("✅ Registrado", tipo === "entrada" ? "Entrada registrada correctamente." : "Salida registrada correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo registrar. Intenta de nuevo.");
    } finally {
      setPosting(false);
    }
  };

  const cardBg  = T.isDark ? "#1A2740" : "#fff";
  const cardBdr = T.isDark ? "#243556" : "#E2E8F5";

  return (
    <LinearGradient colors={T.isDark ? ["#050C1A", "#0D1B3E"] as const : ["#F0F4FA", "#E8EFF8"] as const} style={{ flex: 1 }}>
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Mi Asistencia</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={{ padding: 20, flex: 1 }}>
        {/* Date header */}
        <View style={[s.dateCard, { backgroundColor: T.isDark ? "#0E2040" : "#EFF6FF", borderColor: T.isDark ? "#1E4080" : "#BFDBFE" }]}>
          <Text style={{ fontSize: 28 }}>📅</Text>
          <View style={{ marginLeft: 12 }}>
            <Text style={[s.dateText, { color: T.isDark ? "#93C5FD" : "#1D4ED8" }]}>{today}</Text>
            <Text style={[s.dateLabel, { color: T.isDark ? "#4A6A90" : "#6B84A8" }]}>
              {new Date().toLocaleDateString("es-MX", { weekday:"long", month:"long", day:"numeric" })}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#3B82F6" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Status cards */}
            <View style={s.statusRow}>
              <View style={[s.statusCard, { backgroundColor: cardBg, borderColor: record?.hora_entrada ? "#10B981" : cardBdr }]}>
                <Text style={{ fontSize: 26, marginBottom: 6 }}>🟢</Text>
                <Text style={[s.statusLabel, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>Entrada</Text>
                {record?.hora_entrada ? (
                  <Text style={[s.statusTime, { color: "#10B981" }]}>{record.hora_entrada}</Text>
                ) : (
                  <Text style={[s.statusNone, { color: T.isDark ? "#4A6A90" : "#9BACC8" }]}>Sin registro</Text>
                )}
              </View>
              <View style={[s.statusCard, { backgroundColor: cardBg, borderColor: record?.hora_salida ? "#8B5CF6" : cardBdr }]}>
                <Text style={{ fontSize: 26, marginBottom: 6 }}>🔵</Text>
                <Text style={[s.statusLabel, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>Salida</Text>
                {record?.hora_salida ? (
                  <Text style={[s.statusTime, { color: "#8B5CF6" }]}>{record.hora_salida}</Text>
                ) : (
                  <Text style={[s.statusNone, { color: T.isDark ? "#4A6A90" : "#9BACC8" }]}>Sin registro</Text>
                )}
              </View>
            </View>

            {/* Action buttons */}
            <View style={s.btnCol}>
              {!record?.hora_entrada && (
                <TouchableOpacity
                  style={[s.actionBtn, { opacity: posting ? 0.6 : 1 }]}
                  onPress={() => registrar("entrada")}
                  disabled={posting}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={["#059669", "#10B981"]} style={s.actionGrad}>
                    {posting ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={{ fontSize: 32, marginBottom: 6 }}>🟢</Text>
                        <Text style={s.actionLabel}>Registrar Entrada</Text>
                        <Text style={s.actionSub}>Se registrará tu ubicación</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {record?.hora_entrada && !record?.hora_salida && (
                <TouchableOpacity
                  style={[s.actionBtn, { opacity: posting ? 0.6 : 1 }]}
                  onPress={() => registrar("salida")}
                  disabled={posting}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={["#5B21B6", "#8B5CF6"]} style={s.actionGrad}>
                    {posting ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={{ fontSize: 32, marginBottom: 6 }}>🔵</Text>
                        <Text style={s.actionLabel}>Registrar Salida</Text>
                        <Text style={s.actionSub}>Entrada: {record.hora_entrada}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {record?.hora_entrada && record?.hora_salida && (
                <View style={[s.completeCard, { backgroundColor: cardBg, borderColor: "#10B981" }]}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
                  <Text style={[s.completeTxt, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>Jornada completa</Text>
                  <Text style={[s.completeSub, { color: T.isDark ? "#4A6A90" : "#9BACC8" }]}>
                    Entrada {record.hora_entrada} · Salida {record.hora_salida}
                  </Text>
                </View>
              )}

              {!record?.hora_entrada && !record?.hora_salida && (
                <View style={[s.infoCard, { backgroundColor: T.isDark ? "#0E2040" : "#FFF7ED", borderColor: T.isDark ? "#1E4080" : "#FED7AA" }]}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>⏰</Text>
                  <Text style={[{ fontSize: 13, textAlign:"center", color: T.isDark ? "#93C5FD" : "#92400E" }]}>
                    No has registrado tu asistencia hoy. Usa el botón de arriba para marcar tu entrada.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nav:          { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow:    { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:     { color: "#fff", fontSize: 17, fontWeight: "800" },
  dateCard:     { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
  dateText:     { fontSize: 18, fontWeight: "800" },
  dateLabel:    { fontSize: 12, marginTop: 2 },
  statusRow:    { flexDirection: "row", gap: 12, marginBottom: 20 },
  statusCard:   { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 2 },
  statusLabel:  { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  statusTime:   { fontSize: 20, fontWeight: "900", fontFamily: "monospace" },
  statusNone:   { fontSize: 12 },
  btnCol:       { gap: 12 },
  actionBtn:    { borderRadius: 16, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width:0, height:3 } },
  actionGrad:   { padding: 28, alignItems: "center" },
  actionLabel:  { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 4 },
  actionSub:    { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  completeCard: { borderRadius: 14, padding: 28, alignItems: "center", borderWidth: 2 },
  completeTxt:  { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  completeSub:  { fontSize: 12 },
  infoCard:     { borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1 },
});
