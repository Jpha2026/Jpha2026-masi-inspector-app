import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, OrdenTrabajo } from "../types";
import { API_URL } from "../constants/api";
import { useTheme } from "../hooks/useTheme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Taller">;
  route: RouteProp<RootStackParamList, "Taller">;
};

type Cliente = { id: string; name: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  abierta:    { label: "Abierta",     color: "#D97706", icon: "⏳" },
  en_proceso: { label: "En proceso",  color: "#2563EB", icon: "🔧" },
  cerrada:    { label: "Cerrada",     color: "#059669", icon: "✅" },
  cancelada:  { label: "Cancelada",   color: "#6B7280", icon: "✖️" },
};

const NEXT_STATUS: Record<string, string> = {
  abierta:    "en_proceso",
  en_proceso: "cerrada",
};

const TIPO_LABEL: Record<string, string> = {
  recarga:               "Recarga de extintor",
  mantenimiento:         "Mantenimiento",
  prueba_ph:             "Prueba hidrostática",
  reparacion:            "Reparación",
  inspeccion:            "Inspección",
  preventivo:            "Mantenimiento preventivo",
  correctivo:            "Mantenimiento correctivo",
  otro:                  "Otro",
};
const formatTipo = (t: string) => TIPO_LABEL[t?.toLowerCase()] ?? t;

const TIPOS_OT = [
  "Mantenimiento preventivo",
  "Mantenimiento correctivo",
  "Prueba hidrostática",
  "Recarga de extintor",
  "Reparación",
  "Inspección",
  "Otro",
];

const PRIORIDADES = [
  { key: "baja",   label: "Baja",   color: "#059669" },
  { key: "media",  label: "Media",  color: "#D97706" },
  { key: "alta",   label: "Alta",   color: "#DC2626" },
];

export default function TallerScreen({ navigation, route }: Props) {
  const T = useTheme();
  const { inspectorId, userName } = route.params;

  const [orders, setOrders]         = useState<OrdenTrabajo[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<string>("all");

  // Nueva OT modal
  const [showModal, setShowModal]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otTipo, setOtTipo]         = useState(TIPOS_OT[0]);
  const [otDesc, setOtDesc]         = useState("");
  const [otPrioridad, setOtPrioridad] = useState("media");
  const [otClientId, setOtClientId] = useState("");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ordersRes, clientesRes] = await Promise.all([
        axios.get<OrdenTrabajo[]>(`${API_URL}/mobile/taller?inspector_id=${inspectorId}`),
        axios.get<Cliente[]>(`${API_URL}/clients`),
      ]);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setClientes(Array.isArray(clientesRes.data) ? clientesRes.data : []);
    } catch {
      Alert.alert("Error", "No se pudieron cargar las órdenes de trabajo.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateStatus = async (order: OrdenTrabajo) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const nextCfg = STATUS_CONFIG[next];
    Alert.alert(
      "Actualizar orden",
      `¿Cambiar a "${nextCfg.label}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar", onPress: async () => {
            try {
              await axios.patch(`${API_URL}/mobile/taller`, { id: order.id, status: next, notes: order.notes });
              setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next as OrdenTrabajo["status"] } : o));
            } catch {
              Alert.alert("Error", "No se pudo actualizar la orden.");
            }
          },
        },
      ]
    );
  };

  const handleCreateOT = async () => {
    if (!otDesc.trim()) {
      Alert.alert("Descripción requerida", "Explica brevemente el trabajo a realizar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post<{ folio: string }>(`${API_URL}/mobile/taller`, {
        inspector_id: inspectorId,
        client_id:    otClientId || undefined,
        tipo:         otTipo,
        description:  otDesc.trim(),
        priority:     otPrioridad,
      });
      const folio = res.data?.folio ?? "OT";
      Alert.alert(
        "OT Creada ✅",
        `La orden ${folio} fue creada y enviada al taller.`,
        [{ text: "Aceptar", onPress: () => { setShowModal(false); resetForm(); load(true); } }]
      );
    } catch {
      Alert.alert("Error", "No se pudo crear la orden de trabajo.");
    } finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setOtTipo(TIPOS_OT[0]);
    setOtDesc("");
    setOtPrioridad("media");
    setOtClientId("");
  };

  const FILTERS = ["all", "abierta", "en_proceso", "cerrada"];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const cardBg   = "#fff";
  const cardBdr  = "#E2E8F5";

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4FA" }}>
      <LinearGradient colors={["#0D1B3E", "#122B60"]} style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.navTitle}>Órdenes de Taller</Text>
          {!!userName && <Text style={s.navSub}>{userName}</Text>}
        </View>
        <TouchableOpacity
          style={s.newOtBtn}
          onPress={() => { resetForm(); setShowModal(true); }}
        >
          <Text style={s.newOtText}>+ Nueva</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterBar}
      >
        <View style={s.filterRow}>
          {FILTERS.map(f => {
            const count  = f === "all" ? orders.length : orders.filter(o => o.status === f).length;
            const cfg    = f !== "all" ? STATUS_CONFIG[f] : null;
            const label  = f === "all" ? "Todas" : cfg?.label ?? f;
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[s.filterChip, {
                  backgroundColor: active ? "#122B60" : "#fff",
                  borderColor: active ? "#3B82F6" : "#E2E8F5",
                }]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterText, { color: active ? "#fff" : "#6B84A8" }]}>
                  {cfg ? `${cfg.icon} ` : "📋 "}{label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#3B82F6" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#3B82F6" />}
        >
          {filtered.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: cardBg, borderColor: cardBdr }]}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🔧</Text>
              <Text style={{ color: "#9BACC8", fontSize: 14, textAlign: "center" }}>
                Sin órdenes en esta categoría
              </Text>
            </View>
          ) : (
            filtered.map((order, idx) => {
              const cfg     = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.abierta;
              const next    = NEXT_STATUS[order.status];
              const nextCfg = next ? STATUS_CONFIG[next] : null;
              return (
                <View key={order.id ?? String(idx)} style={[s.orderCard, { backgroundColor: cardBg, borderColor: cardBdr }]}>
                  <View style={s.orderTop}>
                    <View style={[s.statusDot, { backgroundColor: cfg.color + "22", borderColor: cfg.color }]}>
                      <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.orderFolio, { color: "#122B60" }]}>
                        {order.folio || order.id?.slice(0, 8).toUpperCase() || "OT"}
                      </Text>
                      <Text style={[s.orderTipo, { color: "#1A2740" }]}>
                        {order.tipo ? formatTipo(order.tipo) : "Orden de trabajo"}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: cfg.color + "22" }]}>
                      <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  <View style={[s.orderMeta, { borderColor: "#EEF2FB" }]}>
                    {!!order.client_name && (
                      <Text style={[s.metaLine, { color: "#6B84A8" }]}>
                        🏢 {order.client_name}
                      </Text>
                    )}
                    {!!order.notes && (
                      <Text style={[s.metaLine, { color: "#6B84A8" }]} numberOfLines={2}>
                        📝 {order.notes}
                      </Text>
                    )}
                    <Text style={[s.metaDate, { color: "#B0BDCE" }]}>
                      {new Date(order.created_at).toLocaleDateString("es-MX")}
                    </Text>
                  </View>

                  {nextCfg && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: nextCfg.color + "15", borderColor: nextCfg.color }]}
                      onPress={() => handleUpdateStatus(order)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.actionText, { color: nextCfg.color }]}>
                        {nextCfg.icon} Marcar como {nextCfg.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal Nueva OT */}
      <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Nueva Orden de Trabajo</Text>
                <TouchableOpacity onPress={() => setShowModal(false)} style={s.modalClose}>
                  <Text style={{ color: "#6B84A8", fontSize: 20, lineHeight: 22 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Tipo */}
                <Text style={s.fieldLabel}>Tipo de trabajo *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {TIPOS_OT.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.chip, { backgroundColor: otTipo === t ? "#122B60" : "#F0F4FB", borderColor: otTipo === t ? "#3B82F6" : "#D5DCF0" }]}
                      onPress={() => setOtTipo(t)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: otTipo === t ? "#fff" : "#4A6A90" }}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Prioridad */}
                <Text style={[s.fieldLabel, { marginTop: 14 }]}>Prioridad *</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {PRIORIDADES.map(p => (
                    <TouchableOpacity
                      key={p.key}
                      style={[s.chip, { flex: 1, justifyContent: "center", backgroundColor: otPrioridad === p.key ? p.color : "#F0F4FB", borderColor: otPrioridad === p.key ? p.color : "#D5DCF0" }]}
                      onPress={() => setOtPrioridad(p.key)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: otPrioridad === p.key ? "#fff" : "#4A6A90", textAlign: "center" }}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Cliente */}
                {clientes.length > 0 && (
                  <>
                    <Text style={[s.fieldLabel, { marginTop: 14 }]}>Cliente (opcional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                      <TouchableOpacity
                        style={[s.chip, { backgroundColor: !otClientId ? "#122B60" : "#F0F4FB", borderColor: !otClientId ? "#3B82F6" : "#D5DCF0" }]}
                        onPress={() => setOtClientId("")}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: !otClientId ? "#fff" : "#4A6A90" }}>Sin cliente</Text>
                      </TouchableOpacity>
                      {clientes.slice(0, 15).map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[s.chip, { backgroundColor: otClientId === c.id ? "#122B60" : "#F0F4FB", borderColor: otClientId === c.id ? "#3B82F6" : "#D5DCF0" }]}
                          onPress={() => setOtClientId(c.id)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: otClientId === c.id ? "#fff" : "#4A6A90" }}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Descripción */}
                <Text style={[s.fieldLabel, { marginTop: 14 }]}>Descripción del trabajo *</Text>
                <TextInput
                  style={s.textArea}
                  value={otDesc}
                  onChangeText={v => setOtDesc(v.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="DESCRIBE EL TRABAJO A REALIZAR..."
                  placeholderTextColor="#9BACC8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={{ height: 16 }} />

                <LinearGradient colors={["#122B60", "#1D4ED8"]} style={s.submitBtn}>
                  <TouchableOpacity style={s.submitInner} onPress={handleCreateOT} disabled={submitting} activeOpacity={0.85}>
                    {submitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.submitText}>Crear y enviar al taller</Text>
                    }
                  </TouchableOpacity>
                </LinearGradient>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  nav:          { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:      { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backArrow:    { color: "#fff", fontSize: 22, fontWeight: "700" },
  navTitle:     { color: "#fff", fontSize: 17, fontWeight: "800" },
  navSub:       { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 1 },
  newOtBtn:     { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  newOtText:    { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterBar:    { flexGrow: 0 },
  filterRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  filterText:   { fontSize: 13, fontWeight: "700" },
  emptyCard:    { borderRadius: 14, padding: 40, alignItems: "center", borderWidth: 1, marginTop: 20 },
  orderCard:    { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  orderTop:     { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  statusDot:    { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  orderFolio:   { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  orderTipo:    { fontSize: 13, marginTop: 3, color: "#4A5568" },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: "700" },
  orderMeta:    { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  metaLine:     { fontSize: 13, lineHeight: 19 },
  metaDate:     { fontSize: 11, marginTop: 2 },
  actionBtn:    { marginTop: 12, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" },
  actionText:   { fontSize: 14, fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, maxHeight: "90%" },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:   { fontSize: 17, fontWeight: "800", color: "#122B60" },
  modalClose:   { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#F0F4FB" },
  fieldLabel:   { fontSize: 12, fontWeight: "700", color: "#5A6E8C", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  textArea:     { backgroundColor: "#F0F4FB", borderRadius: 12, borderWidth: 1.5, borderColor: "#D5DCF0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1A2740", minHeight: 100, paddingTop: 12 },
  submitBtn:    { borderRadius: 14, overflow: "hidden", elevation: 5, shadowColor: "#122B60", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  submitInner:  { paddingVertical: 16, alignItems: "center" },
  submitText:   { color: "#fff", fontSize: 15, fontWeight: "800" },
});
