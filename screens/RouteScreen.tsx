import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Ruta, RutaItem } from "../types";
import { API_URL } from "../constants/api";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Route">;
  route: RouteProp<RootStackParamList, "Route">;
};

const STATUS_CFG = {
  pendiente:     { label: "Pendiente",    color: "#9CA3AF", bg: "rgba(156,163,175,.12)", icon: "○" },
  inspeccionado: { label: "Inspeccionado",color: "#10B981", bg: "rgba(16,185,129,.12)",  icon: "✓" },
  no_acceso:     { label: "Sin acceso",   color: "#F59E0B", bg: "rgba(245,158,11,.12)",   icon: "!" },
};

export default function RouteScreen({ navigation, route }: Props) {
  const { inspectorId, ruta: rutaParam } = route.params;
  const [ruta, setRuta]         = useState<Ruta & { items?: RutaItem[] }>(rutaParam);
  const [items, setItems]       = useState<RutaItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/mobile/rutas?route_id=${ruta.id}`);
      const data = res.data as Ruta & { items: RutaItem[]; total: number; done: number };
      setRuta(data);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      Alert.alert("Error", "No se pudo cargar la ruta.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [ruta.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total  = items.length;
  const done   = items.filter(i => i.status === "inspeccionado").length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleScanItem = (item: RutaItem) => {
    if (item.status === "inspeccionado") {
      Alert.alert("Ya inspeccionado", "Este equipo ya fue inspeccionado en esta ruta.");
      return;
    }
    navigation.navigate("Scan", {
      inspectorId,
      rutaId: ruta.id,
      rutaItemId: item.id,
      expectedQr: item.expected_qr,
    });
  };

  const handleNoAccess = (item: RutaItem) => {
    Alert.alert(
      "Sin acceso",
      `¿Marcar "${item.equipment_name}" como sin acceso?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sin acceso", style: "destructive",
          onPress: async () => {
            try {
              await axios.patch(`${API_URL}/mobile/rutas`, {
                item_id: item.id, status: "no_acceso", ruta_id: ruta.id,
              });
              setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "no_acceso" } : i));
            } catch { Alert.alert("Error", "No se pudo actualizar."); }
          },
        },
      ]
    );
  };

  const statusColor = ruta.status === "completada" ? "#10B981"
    : ruta.status === "en_proceso" ? "#F59E0B"
    : "#3B82F6";

  if (loading) return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F4FA" }}>
      <ActivityIndicator size="large" color="#122B60" />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F4FA" }} edges={["top"]}>
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{ruta.name}</Text>
          <Text style={s.headerSub}>{ruta.cliente_name}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColor + "30", borderColor: statusColor }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{ruta.status?.toUpperCase()}</Text>
        </View>
      </LinearGradient>

      {/* Progress bar */}
      <View style={s.progressCard}>
        <View style={s.progressRow}>
          <Text style={s.progressLabel}>Progreso de inspección</Text>
          <Text style={s.progressPct}>{done}/{total} equipos</Text>
        </View>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${pct}%` as `${number}%` }]} />
        </View>
        <View style={s.statsRow}>
          {[
            { n: items.filter(i => i.status === "pendiente").length,     label: "Pendientes",  color: "#9CA3AF" },
            { n: items.filter(i => i.status === "inspeccionado").length, label: "Inspeccionados", color: "#10B981" },
            { n: items.filter(i => i.status === "no_acceso").length,     label: "Sin acceso",  color: "#F59E0B" },
          ].map(stat => (
            <View key={stat.label} style={s.statItem}>
              <Text style={[s.statNum, { color: stat.color }]}>{stat.n}</Text>
              <Text style={s.statLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Info row */}
      {(ruta.scheduled_date || ruta.notes) && (
        <View style={s.infoRow}>
          {ruta.scheduled_date && (
            <Text style={s.infoText}>
              📅 {new Date(ruta.scheduled_date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          )}
          {ruta.notes ? <Text style={s.infoNote}>📋 {ruta.notes}</Text> : null}
        </View>
      )}

      <Text style={s.sectionTitle}>Equipos en esta ruta</Text>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#122B60" />}
      >
        {items.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
            <Text style={{ color: "#9BACC8", fontSize: 14 }}>Esta ruta no tiene equipos asignados</Text>
          </View>
        ) : (
          items.map((item, idx) => {
            const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.pendiente;
            const isPending = item.status === "pendiente";
            return (
              <View key={item.id} style={[s.itemCard, !isPending && { opacity: 0.8 }]}>
                <View style={s.itemRow}>
                  <View style={[s.itemNum, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                    <Text style={[s.itemNumText, { color: cfg.color }]}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.itemName} numberOfLines={2}>{item.equipment_name}</Text>
                    <Text style={s.itemMeta}>
                      {item.equipment_type ? `${item.equipment_type} · ` : ""}
                      {item.location || "Sin ubicación"}
                    </Text>
                    {item.serial_number ? (
                      <Text style={s.itemSerial}>Serie: {item.serial_number}</Text>
                    ) : null}
                  </View>
                  <View style={[s.statusChip, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                {isPending && (
                  <View style={s.itemActions}>
                    <TouchableOpacity
                      style={s.scanBtn}
                      onPress={() => handleScanItem(item)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={["#122B60", "#1D4ED8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={s.scanBtnGradient}>
                        <Text style={s.scanBtnText}>📷 Escanear QR</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.noAccessBtn} onPress={() => handleNoAccess(item)} activeOpacity={0.8}>
                      <Text style={s.noAccessText}>Sin acceso</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:        { paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  backBtn:       { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText:      { color: "#fff", fontSize: 22, fontWeight: "700" },
  headerTitle:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub:     { color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText:    { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  progressCard:  { backgroundColor: "#fff", marginHorizontal: 16, marginTop: -10, borderRadius: 16, padding: 16, elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  progressRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 12, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5 },
  progressPct:   { fontSize: 13, fontWeight: "800", color: "#122B60" },
  progressBar:   { height: 8, backgroundColor: "#EEF2FB", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: "#10B981", borderRadius: 4 },
  statsRow:      { flexDirection: "row", marginTop: 12, gap: 0 },
  statItem:      { flex: 1, alignItems: "center" },
  statNum:       { fontSize: 20, fontWeight: "900" },
  statLbl:       { fontSize: 10, color: "#9BACC8", fontWeight: "600", marginTop: 2 },
  infoRow:       { marginHorizontal: 16, marginTop: 10, backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  infoText:      { fontSize: 13, color: "#4A6A90", fontWeight: "600" },
  infoNote:      { fontSize: 12, color: "#9BACC8", marginTop: 4 },
  sectionTitle:  { fontSize: 12, fontWeight: "700", color: "#9BACC8", textTransform: "uppercase", letterSpacing: 0.8, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  emptyBox:      { alignItems: "center", paddingVertical: 40 },
  itemCard:      { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  itemRow:       { flexDirection: "row", alignItems: "flex-start" },
  itemNum:       { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5, flexShrink: 0 },
  itemNumText:   { fontSize: 16, fontWeight: "900" },
  itemName:      { fontSize: 14, fontWeight: "700", color: "#1A2740", lineHeight: 19 },
  itemMeta:      { fontSize: 12, color: "#6B84A8", marginTop: 2 },
  itemSerial:    { fontSize: 11, color: "#9BACC8", marginTop: 2 },
  statusChip:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8, alignSelf: "flex-start" },
  statusChipText:{ fontSize: 10, fontWeight: "700" },
  itemActions:   { flexDirection: "row", gap: 8, marginTop: 12 },
  scanBtn:       { flex: 1, borderRadius: 10, overflow: "hidden", elevation: 3, shadowColor: "#122B60", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  scanBtnGradient: { paddingVertical: 12, alignItems: "center" },
  scanBtnText:   { color: "#fff", fontSize: 13, fontWeight: "800" },
  noAccessBtn:   { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,.08)", alignItems: "center", justifyContent: "center" },
  noAccessText:  { color: "#F59E0B", fontSize: 12, fontWeight: "700" },
});
