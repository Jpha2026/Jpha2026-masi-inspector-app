import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, Pedido } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "MisPedidos">;
  route: RouteProp<RootStackParamList, "MisPedidos">;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pendiente:  { label: "Pendiente",  color: "#D97706", icon: "⏳" },
  aprobado:   { label: "Aprobado",   color: "#059669", icon: "✅" },
  rechazado:  { label: "Rechazado",  color: "#DC2626", icon: "❌" },
  entregado:  { label: "Entregado",  color: "#2563EB", icon: "📦" },
};

const CAT_ICONS: Record<string, string> = {
  limpieza:   "🧹",
  alimentos:  "🥦",
  utensilios: "🍴",
  otro:       "📦",
};

export default function MisPedidosScreen({ navigation, route }: Props) {
  const T = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = route.params;
  const [pedidos, setPedidos]     = useState<Pedido[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (!user.employee_id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await axios.get<Pedido[]>(
        `${API_URL}/mobile/supply-requests?employee_id=${user.employee_id}`
      );
      setPedidos(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const cardBg  = T.isDark ? "#1A2740" : "#fff";
  const cardBdr = T.isDark ? "#243556" : "#E2E8F5";

  return (
    <LinearGradient
      colors={T.isDark ? ["#050C1A", "#0D1B3E"] as const : ["#F0F4FA", "#E8EFF8"] as const}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={[s.nav, { paddingTop: insets.top + 14 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Mis Pedidos de Insumos</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Pedido", { user })}
          style={s.addBtn}
        >
          <Text style={s.addText}>+ Nuevo</Text>
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator color="#8B5CF6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#8B5CF6" />
          }
        >
          {pedidos.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: cardBg, borderColor: cardBdr }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
              <Text style={{ color: T.isDark ? "#4A6A90" : "#9BACC8", fontSize: 14, textAlign: "center" }}>
                Aún no tienes pedidos.{"\n"}Crea uno nuevo con el botón de arriba.
              </Text>
            </View>
          ) : (
            pedidos.map((p) => {
              const st = STATUS_MAP[p.status] ?? STATUS_MAP.pendiente;
              const isOpen = expanded === p.id;
              return (
                <View key={p.id} style={[s.card, { backgroundColor: cardBg, borderColor: cardBdr }]}>
                  {/* Header row */}
                  <TouchableOpacity
                    style={s.cardTop}
                    onPress={() => setExpanded(isOpen ? null : p.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.statusDot, { backgroundColor: st.color + "22", borderColor: st.color + "55" }]}>
                      <Text style={{ fontSize: 18 }}>{st.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.folio, { color: T.isDark ? "#C4D8EE" : "#1A2740" }]}>
                        {p.folio}
                      </Text>
                      <Text style={[s.meta, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                        {p.department || "Sin área"} · {p.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: st.color + "22" }]}>
                      <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                    <Text style={[s.chevron, { color: T.isDark ? "#4A6A90" : "#9BACC8" }]}>
                      {isOpen ? "▲" : "▼"}
                    </Text>
                  </TouchableOpacity>

                  {/* Item count summary */}
                  <View style={[s.itemsBar, { borderColor: T.isDark ? "#1D3050" : "#EEF2FB" }]}>
                    {Array.isArray(p.items) && p.items.length > 0 ? (
                      p.items.slice(0, 3).map((it, idx) => (
                        <View key={idx} style={[s.chip, { backgroundColor: T.isDark ? "#0D1B3E" : "#EFF6FF" }]}>
                          <Text style={{ fontSize: 12 }}>{CAT_ICONS[it.category] ?? "📦"}</Text>
                          <Text style={[s.chipText, { color: T.isDark ? "#60A5FA" : "#1D4ED8" }]}>
                            {it.item_name}
                          </Text>
                          <Text style={[s.chipQty, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                            ×{it.quantity}
                          </Text>
                        </View>
                      ))
                    ) : null}
                    {Array.isArray(p.items) && p.items.length > 3 && (
                      <View style={[s.chip, { backgroundColor: T.isDark ? "#0D1B3E" : "#F5F5F5" }]}>
                        <Text style={[s.chipText, { color: T.isDark ? "#4A6A90" : "#9BACC8" }]}>
                          +{p.items.length - 3} más
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Expanded detail */}
                  {isOpen && (
                    <View style={[s.detail, { borderColor: T.isDark ? "#1D3050" : "#EEF2FB" }]}>
                      {p.notes ? (
                        <Text style={[s.notes, { color: T.isDark ? "#C4D8EE" : "#334155" }]}>
                          📝 {p.notes}
                        </Text>
                      ) : null}
                      {Array.isArray(p.items) && p.items.map((it, idx) => (
                        <View
                          key={idx}
                          style={[s.itemRow, { borderColor: T.isDark ? "#1D3050" : "#EEF2FB" }]}
                        >
                          <Text style={{ fontSize: 18, width: 28 }}>
                            {CAT_ICONS[it.category] ?? "📦"}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.itemName, { color: T.isDark ? "#E2E8F5" : "#1A2740" }]}>
                              {it.item_name}
                            </Text>
                            {it.notes ? (
                              <Text style={[s.itemNotes, { color: T.isDark ? "#4A6A90" : "#8A9BBE" }]}>
                                {it.notes}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[s.qty, { color: T.isDark ? "#60A5FA" : "#1D4ED8" }]}>
                            {it.quantity} {it.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
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
  navTitle:   { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  addBtn:     { backgroundColor: "#7C3AED", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addText:    { color: "#fff", fontWeight: "800", fontSize: 13 },
  emptyCard:  { borderRadius: 14, padding: 40, alignItems: "center", borderWidth: 1, marginTop: 20 },
  card:       { borderRadius: 14, marginBottom: 12, borderWidth: 1, overflow: "hidden" },
  cardTop:    { flexDirection: "row", alignItems: "center", padding: 14 },
  statusDot:  { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  folio:      { fontSize: 15, fontWeight: "800" },
  meta:       { fontSize: 11, marginTop: 2 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 8 },
  badgeText:  { fontSize: 11, fontWeight: "700" },
  chevron:    { fontSize: 12, marginLeft: 4 },
  itemsBar:   { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, paddingTop: 10 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText:   { fontSize: 11, fontWeight: "600" },
  chipQty:    { fontSize: 11 },
  detail:     { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  notes:      { fontSize: 13, marginBottom: 10, lineHeight: 18 },
  itemRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  itemName:   { fontSize: 13, fontWeight: "600" },
  itemNotes:  { fontSize: 11, marginTop: 2 },
  qty:        { fontSize: 13, fontWeight: "700" },
});
